# 09_debugging -- エラーログから複合バグを特定する

所要時間: 約20分

## テーマ

本番環境のエラーログを手がかりに、複数条件が重なったときだけ発生する金額計算バグを特定する。
ポイント利用 + クーポン適用という2つの割引が同時に使われた注文だけで金額不整合が起きる。単体テストでは再現しないタイプのバグで、ログの傾向分析が鍵になる。

## 題材

架空のECサイト注文処理システム。TypeScript 8ファイル、約280行。
税率が8%から10%に切り替わった2025年10月1日以降、ポイントとクーポンを同時使用した注文で金額不整合エラーが断続的に発生している。

バグの本質は、calculateTotal関数がcalculateCouponDiscountを呼ぶ際に渡す引数が間違っている点にある。discount-service.tsのcalculateCouponDiscountは「税込金額全体」を受け取る仕様だが、calculateTotalはポイント差引後の金額（afterPoints）を渡している。同じ関数を呼んでいるため単体テストは通るが、引数が仕様と異なるため結合時に金額が狂う。

applyAllDiscountsという仕様準拠の一括適用関数がdiscount-service.tsに存在するが、calculateTotalはこれを使わず個別に関数を呼んでいる。verifyAmount（検証ロジック）はapplyAllDiscountsを使っているため、両者の結果が食い違う。

9月以前はポイント+クーポン併用注文が偶然存在しなかったためバグが潜伏していた。

## フォルダ構成

```
09_debugging/
  input/
    error-log.txt            -- 本番エラーログ（25件、正常+異常混在）
    src/
      order-service.ts       -- 注文処理メイン（バグの所在: 49行目の引数）
      discount-service.ts    -- 割引処理（applyAllDiscountsが正しい適用順序を持つ）
      tax-calculator.ts      -- 税率計算（日付ベースの税率切替）
      pricing-engine.ts      -- 価格計算パイプライン（バリデーション含む）
      order-repository.ts    -- データベース操作
      notification-service.ts -- 通知処理
      types.ts               -- 型定義
      config.ts              -- 設定定数（DISCOUNT_APPLICATION_ORDERが未参照）
  before/
    debug-log.md             -- 開発者が2時間かけた調査メモ（誤仮説2回→行き詰まり）
  with-ai/
    prompt.md                -- Claude Codeに渡すプロンプトテンプレート
  expected-output/
    diagnosis.md             -- AIによる原因特定・数式証明・修正案
```

## Before / After 比較

before/ のデバッグログでは、開発者が2時間かけて以下の経過をたどっている。

- 仮説1「calculateCouponDiscount内部のMath.floor丸め誤差」を検証 -- 関数を直接呼んでテストし棄却
- 仮説2「税率切替の境界値・タイムゾーン問題」を検証 -- getTaxRateの出力とDate比較を確認して棄却
- ログ全件をExcelに並べ、ポイント+クーポン併用時にのみエラーが出ることを発見
- calculateTotalとverifyAmountの計算パスの違いまで特定。calculateTotalがcalculateCouponDiscountにafterPointsを渡し、verifyAmount（applyAllDiscounts経由）はtotalWithTaxを渡していることを突き止めた
- 「どちらの引数が仕様上正しいか」の確証が持てず、修正に踏み切れなかった。プロダクトオーナー不在で仕様確認もできず

expected-output/ ではAIがログ25件を横断分析し、エラー6件がすべてポイント+クーポン併用であること、差額が「ポイント利用額 x クーポン割引率」に一致することを数式で証明している。discount-service.tsの仕様コメント・applyAllDiscountsの実装・config.tsのDISCOUNT_APPLICATION_ORDER定数から「クーポンは税込金額全体に適用」が仕様であると判断し、calculateTotalの引数をafterPointsからtotalWithTaxに修正するコードを提示。副次的にpricing-engine.tsの判定基準の不統一も指摘している。

## デモ手順

1. input/src/ の8ファイルを俯瞰し、注文処理の流れを把握する（3分）
2. input/error-log.txt を開き、エラーの発生パターンを観察する（2分）
3. before/debug-log.md を読み、人手での調査がどこで行き詰まったか確認する（3分）
4. 受講者に「このログから何が読み取れるか」を考えてもらう（2分）
5. with-ai/prompt.md のプロンプトでClaude Codeに解析させる（5分）
6. expected-output/diagnosis.md と比較し、AIの推論プロセスを解説する（5分）

## 学びのポイント

- 人間はログを1件ずつ追いやすく、仮説ベースの調査になる。有力に見える仮説（丸め誤差、税率境界値）に時間を費やした結果、本質に到達するまで2時間かかった。AIはログ25件を一度に走査し、条件ベースのパターン分類から入る。発見の速度が違う

- 差額が「ポイント x クーポン率」に従うという法則性は、6件分の数値を横断比較しないと見えない。人間がExcelに並べて気づく作業を、AIは即座にやれる

- 同じ関数（calculateCouponDiscount）を呼んでいるのに引数が1つ違うだけで壊れる。単体テストは関数の内部ロジックを検証するが、「何を渡すか」は呼び出し元の責任。この種のバグは結合テストかコードレビューでしか捕まえられない

- discount-service.tsのコメント、applyAllDiscountsの存在、config.tsの定数。人間の開発者はこれらを「たぶん仕様はこうだろう」と推測しつつも確証が持てなかった。AIはコード内の複数箇所の証拠を統合し、仕様意図を高い確度で読み取れる

- AIが提示する修正案が業務仕様に合致するかの最終判断は人間が行う。クーポンとポイントの適用順序はビジネスルールであり、コードの証拠は傍証にすぎない
