# デプロイガイド


## 前提条件

- Node.js 18以上
- PostgreSQL 15以上
- npm 9以上（または yarn 1.22以上）
- Docker / Docker Compose（コンテナデプロイの場合）


## ローカルでのビルドと実行

### 1. 依存パッケージのインストール

```bash
npm ci
```

開発用依存パッケージを含めない場合:

```bash
npm ci --production
```

### 2. Prismaクライアントの生成

```bash
npx prisma generate
```

### 3. データベースマイグレーション

開発環境:

```bash
npx prisma migrate dev
```

本番環境:

```bash
npx prisma migrate deploy
```

migrate deploy はマイグレーションファイルの適用のみ行い、新しいマイグレーションの生成は行わない。

### 4. TypeScriptのビルド

```bash
npx tsc
```

出力先はtsconfig.jsonの outDir 設定に依存する（推定）。

### 5. サーバー起動

```bash
NODE_ENV=production node dist/server.js
```


## Docker によるデプロイ

### Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:18-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
```

ビルドと実行:

```bash
docker build -t ecshop-api .
docker run -d \
  --name ecshop-api \
  -p 4000:4000 \
  --env-file .env \
  ecshop-api
```

### docker-compose.yml

アプリケーションとPostgreSQLを一括で起動する構成。

```yaml
version: "3.9"

services:
  api:
    build: .
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://appuser:dbpassword@db:5432/ecshop?schema=public
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_EXPIRES_IN: 15m
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}
      RATE_LIMIT_WINDOW_MS: 900000
      RATE_LIMIT_MAX: 100
      TAX_RATE: "0.10"
      FREE_SHIPPING_THRESHOLD: 5000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: dbpassword
      POSTGRES_DB: ecshop
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d ecshop"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

起動:

```bash
docker compose up -d
```

マイグレーション実行（初回のみ）:

```bash
docker compose exec api npx prisma migrate deploy
```


## ヘルスチェック

### エンドポイント

```
GET /health
```

### 正常時のレスポンス

HTTP 200

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-24T10:00:00.000Z"
}
```

### 監視の設定例

ロードバランサーやコンテナオーケストレーターのヘルスチェックに /health を設定する。

- パス: /health
- 期待するステータスコード: 200
- チェック間隔: 30秒
- タイムアウト: 5秒
- 異常判定の閾値: 3回連続失敗


## 本番環境のチェックリスト

デプロイ前に以下を確認する。

環境変数:
- JWT_SECRET と JWT_REFRESH_SECRET に十分な長さのランダム文字列を設定したか
- DATABASE_URL の接続情報は正しいか
- CORS_ORIGIN にフロントエンドの本番URLを設定したか
- NODE_ENV を production に設定したか
- RATE_LIMIT_MAX を本番の想定トラフィックに合わせて調整したか
- TAX_RATE が正しい税率か確認したか

データベース:
- マイグレーションが全て適用されているか
- データベースユーザーの権限は最小限になっているか
- 接続先のPostgreSQLにSSL接続しているか（推定: DATABASE_URLに sslmode=require を付与）

ネットワーク:
- APIサーバーのポート（デフォルト4000）が外部に直接公開されていないか
- リバースプロキシ（nginx等）経由でHTTPS終端しているか
- CORSの設定が本番のドメインに限定されているか（credentials: true のためワイルドカード不可）

プロセス管理:
- プロセスマネージャー（PM2等）またはコンテナオーケストレーターで管理しているか
- ログの収集と保存の仕組みがあるか（構造化JSONログ形式で出力される）
- 異常終了時の自動再起動が設定されているか
