# EC商品管理API

商品カタログ、注文処理、カテゴリ管理を提供するREST API。JWT認証とロールベースのアクセス制御、注文のステータス遷移管理、在庫の自動減算、税計算と送料計算を備える。


## 技術スタック

| 分類 | 技術 |
|------|------|
| ランタイム | Node.js |
| 言語 | TypeScript |
| フレームワーク | Express |
| ORM | Prisma |
| バリデーション | Zod |
| 認証 | JSON Web Token (jsonwebtoken) |
| パスワードハッシュ | bcryptjs |
| セキュリティ | helmet, cors, express-rate-limit |


## セットアップ

### 前提条件

- Node.js 18以上
- PostgreSQL 15以上（Prisma経由で接続）
- npm または yarn

### 手順

```bash
git clone <repository-url>
cd <project-directory>

npm install

cp .env.example .env
# .envを編集してデータベース接続情報、JWTシークレット等を設定する

npx prisma migrate dev

npm run dev
```

サーバーが起動したら http://localhost:4000/health にアクセスして動作を確認する。

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-24T10:00:00.000Z"
}
```


## ディレクトリ構成

```
src/
  server.ts                Expressアプリケーションのエントリーポイント。
                           helmet, cors, express-rate-limit, JSONパーサー、
                           リクエストロガーの登録、ルーティング、ヘルスチェック、
                           エラーハンドラの設定を行う。

  routes/
    index.ts               全ルーターの登録。/api/auth, /api/products,
                           /api/orders, /api/categories の4つのパスに分配する。
    products.ts            商品のCRUD操作。一覧取得はページネーション、カテゴリ
                           フィルタ、キーワード検索、価格帯絞り込み、ソートに対応。
                           作成・更新・削除はadminロール限定。
    orders.ts              注文の作成・一覧・詳細・ステータス更新・キャンセル。
                           全操作が要認証。作成時に在庫チェック、税計算、送料計算、
                           クーポン適用をトランザクション内で実行する。
                           ステータス更新はadminロール限定。
    auth.ts                ユーザー登録、ログイン、トークンリフレッシュ、
                           ユーザー情報取得の4エンドポイント。
                           bcryptによるパスワードハッシュとJWTトークンペア発行。
    categories.ts          カテゴリのCRUD操作。階層構造（parentId）に対応。
                           作成・更新・削除はadminロール限定。
                           商品が紐づくカテゴリの削除を禁止する制約あり。

  middleware/
    auth.ts                JWTベースの認証ミドルウェア。Authorizationヘッダーから
                           Bearerトークンを取得し、デコード後にDBでユーザー存在確認。
                           requireRole関数でロールベースのアクセス制御も提供する。
    validation.ts          Zodスキーマによるリクエストボディ・クエリパラメータの検証。
                           バリデーションエラー時は400レスポンスとフィールド別エラー詳細を返す。
    logger.ts              構造化JSONログの出力。HTTPメソッド、パス、ステータスコード、
                           レスポンスタイム、User-Agent、IPアドレスを記録する。

  db/
    prisma.ts              Prismaクライアントのシングルトン管理。
                           開発環境ではグローバル変数にキャッシュしてHot Reload時の
                           コネクション増加を防止する。DB接続チェック関数も提供。

  utils/
    errors.ts              AppErrorを基底クラスとするカスタムエラー群。
                           NotFoundError(404), BadRequestError(400),
                           UnauthorizedError(401), ForbiddenError(403),
                           ConflictError(409)。エラーコード（code）付き。
                           Expressエラーハンドラが自動でステータスコードを設定する。
    tax.ts                 税額計算、送料計算、送料無料判定のユーティリティ。
                           税率と送料無料閾値は環境変数で設定可能。

  types/
    index.ts               プロジェクト全体で使用する型定義。
                           OrderStatus, JwtPayload, UserRole, ページネーション型、
                           各リソースの入力型、トークンペア型、配送料金型を含む。
```


## 関連ドキュメント

- api-reference.md -- 全エンドポイントの仕様とリクエスト/レスポンス例
- architecture.md -- アーキテクチャ概要とMermaid図
- env-vars.md -- 環境変数の一覧
- deploy-guide.md -- デプロイ手順
