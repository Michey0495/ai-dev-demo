# 環境変数リファレンス

コード内で参照されている全ての環境変数の一覧。


## 変数一覧

| 変数名 | 必須 | デフォルト値 | 説明 |
|--------|------|------------|------|
| PORT | 任意 | 4000 | サーバーの待受ポート番号 |
| NODE_ENV | 任意 | - | 実行環境。development でPrismaのクエリログが有効になる |
| DATABASE_URL | 必須 | - | PostgreSQL接続文字列。Prismaが使用する |
| JWT_SECRET | 必須 | - | アクセストークン署名用のシークレットキー |
| JWT_REFRESH_SECRET | 必須 | - | リフレッシュトークン署名用のシークレットキー |
| JWT_EXPIRES_IN | 任意 | 15m | アクセストークンの有効期限 |
| CORS_ORIGIN | 任意 | http://localhost:3000 | CORSで許可するオリジン |
| RATE_LIMIT_WINDOW_MS | 任意 | 900000（15分） | レート制限のウィンドウ幅（ミリ秒） |
| RATE_LIMIT_MAX | 任意 | 100 | ウィンドウあたりの最大リクエスト数 |
| TAX_RATE | 任意 | 0.10 | 消費税率（0.10 = 10%） |
| FREE_SHIPPING_THRESHOLD | 任意 | 5000 | 送料無料になる小計の閾値（円） |


## 各変数の詳細

### PORT

サーバーが待ち受けるTCPポート番号。Number()で変換されるため、数値文字列を指定する。指定しない場合は4000番で起動する。

参照箇所: `server.ts`

### NODE_ENV

Prismaクライアントの挙動に影響する。development に設定するとSQLクエリログとwarningがコンソールに出力される。production では error レベルのログのみ出力。加えて、production 以外の場合はPrismaクライアントがグローバル変数にキャッシュされ、開発中のHot Reload時にDBコネクションが増殖する問題を防ぐ。

サーバー起動時のログメッセージにも表示される。test に設定するとリクエストロガーの出力が抑制される。

参照箇所: `db/prisma.ts`, `server.ts`, `middleware/logger.ts`

### DATABASE_URL

Prismaが接続先のPostgreSQLを特定するために使用する。Prismaスキーマファイル内の datasource 定義から参照される。コード内では明示的に datasources オプションでも渡されている。

形式: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA`

参照箇所: `db/prisma.ts`

### JWT_SECRET

jsonwebtokenライブラリがアクセストークンの署名と検証に使用する。十分なランダム性を持つ文字列を設定すること。本番環境では最低32文字以上を推奨する。コード上では `!` 演算子（非nullアサーション）付きで参照されているため、未設定の場合は実行時エラーになる。

参照箇所: `middleware/auth.ts`, `routes/auth.ts`

### JWT_REFRESH_SECRET

リフレッシュトークンの署名と検証に使用する。アクセストークン用とは別のシークレットを使うことで、一方が漏洩した場合の影響を限定している。JWT_SECRET と同様に非nullアサーション付き。

参照箇所: `routes/auth.ts`

### JWT_EXPIRES_IN

jwt.signの expiresIn オプションに渡される。jsonwebtokenライブラリが解釈できる形式で指定する。数値の場合は秒数、文字列の場合は "15m"（15分）、"1h"（1時間）のような形式。リフレッシュトークンの有効期限は7日間でハードコードされている。

参照箇所: `routes/auth.ts`

### CORS_ORIGIN

Express cors ミドルウェアの origin オプションに渡される。フロントエンドのURLを指定する。credentials: true が設定されているため、本番環境ではワイルドカード（*）は使用できない。

参照箇所: `server.ts`

### RATE_LIMIT_WINDOW_MS

express-rate-limit の windowMs オプションに渡される。ミリ秒単位で指定する。デフォルトは900000（15分）。

参照箇所: `server.ts`

### RATE_LIMIT_MAX

express-rate-limit の max オプションに渡される。1ウィンドウあたりの最大リクエスト数。デフォルトは100。

参照箇所: `server.ts`

### TAX_RATE

消費税率。小数で指定する（0.10 = 10%）。Math.floorで端数切り捨て処理が行われる。

参照箇所: `utils/tax.ts`

### FREE_SHIPPING_THRESHOLD

送料無料になる小計（税抜・割引後）の閾値。円単位で指定する。デフォルトは5000円。この閾値以上の注文は送料が0円になる。

参照箇所: `utils/tax.ts`


## .env テンプレート

以下の内容を .env ファイルとしてプロジェクトルートに配置する。値はダミーのため、環境に合わせて書き換えること。

```env
PORT=4000
NODE_ENV=development

DATABASE_URL=postgresql://appuser:localdevpassword@localhost:5432/ecshop_dev?schema=public

JWT_SECRET=dev-jwt-secret-change-me-in-production-abc123
JWT_REFRESH_SECRET=dev-refresh-secret-change-me-in-production-xyz789
JWT_EXPIRES_IN=15m

CORS_ORIGIN=http://localhost:3000

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

TAX_RATE=0.10
FREE_SHIPPING_THRESHOLD=5000
```

本番環境では JWT_SECRET と JWT_REFRESH_SECRET に暗号論的に安全なランダム文字列を設定する。以下のコマンドで生成できる。

```bash
openssl rand -base64 48
```
