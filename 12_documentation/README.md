# テーマ12: ドキュメント自動生成

ドキュメントが一切ないコードベースから、AIを使って5種類のドキュメントを自動生成するデモ。

対象は約700行、13ファイルのTypeScript製EC REST API。Prisma、Zod、JWT、ロールベースアクセス制御、税計算、送料計算、クーポン適用、レート制限といった実務で頻出する要素を備えた構成になっている。コードの品質自体は高いが、コメントもREADMEも何もない状態がスタート地点となる。


## Before: 人手で書いた場合

before/api-reference.md を参照。

週末に急いで書いたAPI仕様書が1つだけ存在する状態。中身を見ると問題が多い。

- 20あるエンドポイントのうち5つしかカバーしていない
- リクエスト/レスポンスの具体例がない、あっても形式が間違っている
- ステータスコードに誤りがある箇所が複数（POST成功を200と記載）
- 認証やロール制御の説明が曖昧
- エラーレスポンスの定義がない
- コードに存在しないフィールドへの言及がある（tags, keyword, pass等）
- フォーマットが統一されていない（JSONがコードブロック外に書かれている箇所あり）
- TODOが大量に残っている
- 個人メモが混在している

実務でよく見る光景そのものだろう。コードは動いているのにドキュメントだけが腐っている。


## After: AIで生成した場合

expected-output/ 以下に5種類のドキュメントが揃う。

| ファイル | 内容 |
|---------|------|
| README.md | プロジェクト概要、技術スタック、セットアップ手順、ディレクトリ構成 |
| api-reference.md | 全20エンドポイントの仕様、リクエスト/レスポンス例、認証・ロール要件、レート制限、エラーコード |
| architecture.md | アーキテクチャ概要、Mermaidによるコンポーネント図・リクエストフロー図・ステータス遷移図・注文作成フロー図 |
| env-vars.md | 環境変数11個の一覧、必須/任意の区分、参照箇所、サンプル値 |
| deploy-guide.md | デプロイ手順、前提条件、ビルド、Docker構成、ヘルスチェック、本番チェックリスト |

コードの実装から正確に読み取った内容なので、before版にあった「コードと乖離したドキュメント」問題が発生しない。


## 手順

1. input/src/ のコードを確認する。約700行、13ファイルのTypeScript REST API。コメントもドキュメントも一切ない
2. before/api-reference.md を読み、人手で書いたドキュメントの品質を確認する
3. with-ai/prompt.md のプロンプトテンプレートをClaude Codeに投入する
4. 生成結果を expected-output/ の各ファイルと比較する
5. コードを変更した場合に、ドキュメントの再生成がどの程度正確かを検証する


## ディレクトリ構成

```
12_documentation/
  input/
    src/
      server.ts              - Expressサーバー設定（helmet, cors, rate-limit, logger）
      routes/
        index.ts             - ルート登録（4リソース）
        products.ts          - 商品CRUD（検索、価格帯フィルタ、ソート対応）
        orders.ts            - 注文管理（ステータス遷移、税計算、送料、クーポン）
        auth.ts              - 認証（登録/ログイン/リフレッシュ/ユーザー情報取得）
        categories.ts        - カテゴリCRUD（階層構造、slug一意制約）
      middleware/
        auth.ts              - JWT認証 + ロールベースアクセス制御
        validation.ts        - Zodバリデーション（body + query）
        logger.ts            - 構造化JSONリクエストログ
      db/
        prisma.ts            - Prismaクライアント（シングルトン、接続チェック）
      utils/
        errors.ts            - カスタムエラークラス（5種 + エラーコード付き）
        tax.ts               - 税額計算・送料計算・送料無料判定
      types/
        index.ts             - 共有型定義（OrderStatus, UserRole, JWT, Pagination等）
  before/
    api-reference.md         - 人手で書いた不完全なAPI仕様書
  with-ai/
    prompt.md                - Claude Code用プロンプトテンプレート
  expected-output/
    README.md                - プロジェクトREADME
    api-reference.md         - 完全版API仕様書
    architecture.md          - アーキテクチャ概要
    env-vars.md              - 環境変数リファレンス
    deploy-guide.md          - デプロイガイド
```


## 学習ポイント

ドキュメント生成でAIが力を発揮するのは「コードから機械的に読み取れる事実の網羅」にある。エンドポイントの列挙、Zodスキーマからのバリデーションルール転記、process.envの洗い出し、ステータス遷移の図示など、人間がやると見落としがちな作業をAIは漏れなくこなす。

一方で、設計意図や運用上の注意点といった「コードに書かれていない知識」は人間が補足する必要がある。AIが生成したドキュメントをベースに、チーム固有の文脈を加筆するワークフローが現実的な運用になる。

このデモでは特に以下の差に注目してほしい。

- before版のTODOリストの量と、expected-output版の網羅度の差
- before版のフィールド名の間違い（pass, keyword, products等）とコードの実装の食い違い
- 税計算・送料計算・クーポンといった複雑なビジネスロジックの文書化精度
- ロールベースアクセス制御の正確な反映
