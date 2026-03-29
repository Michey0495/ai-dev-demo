# デバッグ調査メモ

担当: 田中
日付: 2025-10-01
対象: 注文金額不整合エラー（ORD-20251001-004 他、翌日の10/2にも再発を確認）

---

10:30 -- Slackの#alertsでエラー通知を拾う。本日9:22から金額不整合エラーが5件出ている。差額は20円から200円。金額帯にもユーザーにも規則性が見えない。スタックトレースを見ると全件order-service.ts:29のprocessOrderから出ている。calculateTotalとverifyAmountの突合で引っかかっている。

10:38 -- まず差額に着目する。60, 50, 200, 20, 120。桁がバラバラ。丸め誤差なら1円単位のはずだが、20円や200円が出ている。浮動小数点由来ではない。何かの掛け算が合っていない予感がする。

10:42 -- 仮説1: calculateCouponDiscountの内部でMath.floorの適用位置がずれている。クーポン割引率と金額の組み合わせ次第で切り捨て量が変わり、検証側と差が出る。

10:48 -- discount-service.tsを開く。calculateCouponDiscountは単純な構造。amountWithTaxを受け取り、coupon.discountRateを掛けてMath.floorする。ここで変なことをしている形跡はない。念のためテストする。

10:55 -- テスト1: calculateCouponDiscount(3300, {code:'CP-AUTUMN20', discountRate:0.2, minOrderAmount:1000})。結果: 660。手計算と一致。

11:00 -- テスト2: calculateCouponDiscount(6050, {code:'CP-WELCOME10', discountRate:0.1, minOrderAmount:500})。結果: 605。正しい。

11:05 -- テスト3: 端数が出やすいパターンを試す。calculateCouponDiscount(2750, coupon10%)。結果: 275。手計算の2750*0.1=275と一致。Math.floorの挙動に問題はない。

11:12 -- calculatePointDiscountも確認。calculatePointDiscount(3300, 300)は300。calculatePointDiscount(100, 500)は100（上限キャップ）。こちらも正常。

11:15 -- 仮説1棄却。個々の割引計算関数は単体で正しく動いている。

11:20 -- 仮説2: 税率切替のタイミング問題。10/1 0:00ちょうどにDate比較の境界値バグがあるのでは。getTaxRateに注入するDate次第でcalculateTotalとverifyAmountで参照する税率が食い違う可能性。

11:25 -- tax-calculator.ts を確認。getTaxRateはeffectiveFromをソートしてorderDate >= effectiveFromで判定。>=なので10/1当日は新税率。

11:30 -- テスト: getTaxRate(new Date('2025-10-01T09:22:07'))。結果: 0.10。getTaxRate(new Date('2025-09-30T23:59:59'))。結果: 0.08。境界は正しく動く。

11:35 -- サーバのTZを確認。Asia/Tokyo。UTCとの差は+9時間。new Date('2025-10-01')がJSTかUTCか。nodeのDateコンストラクタはISO 8601形式ならUTCとして解釈する。effectiveFromのnew Date('2025-10-01')はUTC 0:00=JST 9:00。実際の注文は10/1 9:22 JST。JST 9:22 > JST 9:00（UTC 0:22 > UTC 0:00）。税率10%が正しく適用される。

11:42 -- calculateTotalとverifyAmountの中にログを入れて同じorderDateで実行。両方とも0.10を返す。

11:48 -- 仮説2棄却。税率の取得は問題ない。

11:55 -- 一歩引いて考え直す。エラーが出る注文と出ない注文の違いはなんだ。ログを再確認する。

...ポイントありかつクーポンあり、の注文だけで出ている気がする。

12:00 -- 昼休憩。頭をリセットする。

12:35 -- 戻ってきてExcelに全注文を並べた。ポイント・クーポンの有無で分類。

  9/28: ポイントのみ2件、クーポンのみ2件、なし3件、併用0件 → エラー0
  10/1: ポイントのみ5件、クーポンのみ3件、なし3件、併用5件 → エラー5

  エラーは全件「ポイントあり かつ クーポンあり」。これで確定。9月は併用注文が存在しなかったから潜伏していたのか。

12:45 -- order-service.tsに戻る。calculateTotalとverifyAmountをじっくり読み比べる。

calculateTotalの流れ:
  1. 税込金額算出
  2. calculatePointDiscount(totalWithTax, pointsUsed) → pointDiscount
  3. afterPoints = totalWithTax - pointDiscount
  4. calculateCouponDiscount(afterPoints, coupon) → couponDiscount
  5. finalAmount = afterPoints - couponDiscount

verifyAmountの流れ:
  applyAllDiscounts(totalWithTax, pointsUsed, coupon)を呼んでいる。
  discount-service.tsのapplyAllDiscountsを確認。
  1. calculateCouponDiscount(totalWithTax, coupon) → couponDiscount
  2. afterCoupon = totalWithTax - couponDiscount
  3. calculatePointDiscount(afterCoupon, pointsUsed) → pointDiscount
  4. finalAmount = afterCoupon - pointDiscount

12:52 -- 差が見えた。calculateTotalはcalculateCouponDiscountにafterPoints（ポイント差引後の金額）を渡している。verifyAmount経由のapplyAllDiscountsはtotalWithTax（ポイント差引前の金額）を渡している。

12:55 -- テスト。商品合計3,000円、ポイント300、クーポン20%OFF、税率10%。

calculateTotal側:
  totalWithTax = 3,300
  pointDiscount = 300
  afterPoints = 3,000
  couponDiscount = calculateCouponDiscount(3000, coupon) = floor(3000 * 0.2) = 600
  finalAmount = 3,000 - 600 = 2,400

verifyAmount側（applyAllDiscounts）:
  couponDiscount = calculateCouponDiscount(3300, coupon) = floor(3300 * 0.2) = 660
  afterCoupon = 3,300 - 660 = 2,640
  pointDiscount = min(300, 2640) = 300
  finalAmount = 2,640 - 300 = 2,340

差額 = 2,400 - 2,340 = 60。ログの差額と一致。

13:00 -- 原因の箇所は特定できた。calculateTotalの49行目で、calculateCouponDiscountにafterPointsを渡しているところ。verifyAmount側はtotalWithTaxを渡している。関数呼び出し自体は同じcalculateCouponDiscountなのに、引数が違う。

13:05 -- ただ、ここで止まる。どちらの引数が「正しい」のかがわからない。

discount-service.tsの関数コメントには「クーポンは税込金額に対して割引率を適用する」と書いてある。applyAllDiscountsのコメントにも「クーポン（税込金額全体ベース） → ポイント」とある。これに従えばtotalWithTaxが正しい。verifyAmount側が正。

でもcalculateTotalの49行目のコメントにも「税込金額に対して割引率を適用」と書いてあって、コメントと実際のコードが食い違っている。誰かがafterPointsに変数名を変えたのか、もともとこう書いたのか。git blameで追えば経緯がわかるかもしれないが、本番リポのブランチ構成を今から追うのは重い。

13:10 -- もう一つの謎。discount-service.tsにapplyAllDiscountsという「全割引一括適用」の関数がある。verifyAmountはこれを使っている。calculateTotalはなぜこれを使わず、個別にcalculatePointDiscountとcalculateCouponDiscountを呼んでいるのか。applyAllDiscountsを使えば適用順序の問題は起きなかった。

13:15 -- config.tsにDISCOUNT_APPLICATION_ORDERという定数も定義されている。['coupon', 'point']。クーポンが先。この定数はどこからも参照されていない。仕様はクーポン先適用で合っているはず。

13:20 -- calculateTotalのコメントとコード実体の食い違い、applyAllDiscountsの不使用、DISCOUNT_APPLICATION_ORDERの未参照。状況証拠的にはverifyAmount側が正しいように見える。だが「状況証拠」で本番コードを書き換える判断はできない。プロダクトオーナーの武田さんに聞きたいが、今日は外出で連絡がつかない。

13:25 -- pricing-engine.tsも一応確認。validateCouponEligibilityがsubtotal（税抜）でクーポン適用可否を判定している。一方calculateCouponDiscountはamountWithTax（税込）で最低注文金額を判定する。ここも微妙に基準がずれているが、今回のエラー注文はどれもminOrderAmountを大きく超えているから今回は関係ない。放置していいかは別途検討が必要。

13:30 -- 2時間経過。一旦切り上げて上長に報告する。

把握できたこと:
- ポイント+クーポン併用時にのみ発生。9月以前は該当注文なし
- calculateTotal(49行目)がcalculateCouponDiscountにafterPointsを渡している
- verifyAmount(applyAllDiscounts経由)はtotalWithTaxを渡している
- 差額 = ポイント利用額 x クーポン割引率（概算）

判断がつかないこと:
- クーポン割引のベース金額は「税込金額全体」と「ポイント適用後」のどちらが仕様か
- calculateTotalがapplyAllDiscountsを使っていない経緯
- config.tsのDISCOUNT_APPLICATION_ORDERが参照されていない理由

次にやること:
- プロダクトオーナーに割引適用順序の仕様確認
- git blameでcalculateTotal周辺の変更履歴を追う
- 暫定対応としてエラー注文の手動補正が必要か判断
