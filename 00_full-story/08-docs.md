# TeamTalk 開発ドキュメント

バージョン: 1.0.0
最終更新: 2026-03-29
ステータス: AI生成ドラフト（人間レビュー待ち）


## アーキテクチャ概要

TeamTalkはCloudflare Workers上で動作する社内チャットアプリケーション。フロントエンドはReact + TypeScript、バックエンドはHonoフレームワークを採用している。

```
ブラウザ (React + Tailwind)
    |
    v
Cloudflare Workers (Hono)
    |
    +---> D1 (PostgreSQL互換) ... メッセージ、ユーザー、チャンネル
    +---> R2 (S3互換) .......... ファイルストレージ
    +---> Durable Objects ...... WebSocket接続管理
```

リクエストの流れ:
1. クライアントがHTTPリクエストを送信
2. Cloudflare Workersがリクエストを受け取る
3. JWTミドルウェアがトークンを検証
4. Honoルーターが適切なハンドラに振り分ける
5. Zodがリクエストボディをバリデーション
6. D1データベースに対してクエリを実行
7. レスポンスをJSON形式で返却


## API一覧

### 認証

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /auth/login | ログイン（JWT発行） |
| POST | /auth/refresh | トークンリフレッシュ |

### ユーザー

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /users/me | 自分のプロフィール取得 |
| PATCH | /users/me | プロフィール更新 |

### チャンネル

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /channels | チャンネル一覧取得 |
| POST | /channels | チャンネル作成 |

### メッセージ

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /channels/:id/messages | メッセージ一覧取得 |
| POST | /channels/:id/messages | メッセージ送信 |
| PATCH | /channels/:id/messages/:mid | メッセージ編集（5分以内） |
| DELETE | /channels/:id/messages/:mid | メッセージ削除（論理削除） |

### リアクション

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /channels/:id/messages/:mid/reactions | リアクション追加 |
| DELETE | /channels/:id/messages/:mid/reactions?emoji=xxx | リアクション削除 |

### 検索

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /search?q=xxx | メッセージ全文検索 |

認証が不要なエンドポイントは /auth/login と /auth/refresh のみ。他はすべてAuthorizationヘッダーにBearer JWTトークンが必要。


## データモデル

### users

| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| display_name | VARCHAR(100) | NOT NULL |
| avatar_url | TEXT | NULL |
| status_message | VARCHAR(200) | DEFAULT '' |
| presence | VARCHAR(20) | online / offline / away |
| role | VARCHAR(20) | admin / member / guest |
| last_seen_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### channels

| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| name | VARCHAR(80) | NOT NULL |
| description | TEXT | DEFAULT '' |
| type | VARCHAR(20) | public / private / dm / group_dm |
| created_by | UUID | FK -> users |
| is_archived | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### messages

| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| channel_id | UUID | FK -> channels |
| user_id | UUID | FK -> users |
| content | TEXT | NOT NULL |
| thread_id | UUID | FK -> messages (NULL可) |
| is_edited | BOOLEAN | DEFAULT FALSE |
| is_deleted | BOOLEAN | DEFAULT FALSE |
| search_vector | tsvector | 自動生成（全文検索用） |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### reactions

| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| message_id | UUID | FK -> messages |
| user_id | UUID | FK -> users |
| emoji | VARCHAR(50) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

UNIQUE制約: (message_id, user_id, emoji)

### attachments

| カラム | 型 | 制約 |
|--------|-----|------|
| id | UUID | PK |
| message_id | UUID | FK -> messages |
| file_name | VARCHAR(255) | NOT NULL |
| file_size | BIGINT | 1B - 50MB |
| mime_type | VARCHAR(100) | NOT NULL |
| storage_key | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |


## 認証フロー

1. クライアントが /auth/login にメールとパスワードを送信
2. サーバーがbcryptでハッシュを検証
3. 検証成功時、JWTアクセストークン（有効期限24時間）とリフレッシュトークン（7日）を発行
4. クライアントは以降のリクエストで Authorization: Bearer {token} を付与
5. トークン期限切れ時は /auth/refresh で新しいアクセストークンを取得

JWTペイロード:
```json
{
  "userId": "uuid",
  "role": "member",
  "iat": 1234567890,
  "exp": 1234654290
}
```


## エラーレスポンス形式

すべてのエラーは以下の統一形式で返却する。

```json
{
  "error": {
    "code": "HTTP_400",
    "message": "メッセージは4000文字以内です"
  }
}
```

主要なHTTPステータスコード:
- 400: バリデーションエラー
- 401: 認証が必要
- 403: 権限不足
- 404: リソースが見つからない
- 409: 競合（重複リアクションなど）
- 410: 期限切れ（編集可能時間超過）
- 500: サーバー内部エラー


## デプロイ手順

### 前提条件

- Node.js 20以上
- Wrangler CLI（`npm install -g wrangler`）
- Cloudflareアカウント

### 初回セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/acme/teamtalk.git
cd teamtalk

# 依存パッケージのインストール
npm install

# D1データベースの作成
wrangler d1 create teamtalk-db

# wrangler.toml にデータベースIDを設定
# [[d1_databases]]
# binding = "DB"
# database_name = "teamtalk-db"
# database_id = "<出力されたID>"

# スキーマの適用
wrangler d1 execute teamtalk-db --file=./02-db-schema.sql

# R2バケットの作成
wrangler r2 bucket create teamtalk-files
```

### デプロイ

```bash
# ステージング環境
wrangler deploy --env staging

# 本番環境
wrangler deploy --env production
```

### 環境変数

wrangler.toml で設定する:

```toml
[vars]
JWT_SECRET = ""          # 本番ではwrangler secretで設定
ALLOWED_ORIGINS = ""     # CORS許可オリジン
MAX_FILE_SIZE = 52428800 # 50MB
```

機密情報は `wrangler secret put JWT_SECRET` で設定する。wrangler.tomlには絶対に書かない。


## 運用

### 監視項目

- Workers の呼び出し回数とエラー率（Cloudflare Dashboard）
- D1 のクエリ実行時間
- R2 のストレージ使用量
- WebSocket接続数（Durable Objects Analytics）

### バックアップ

- D1: Cloudflareが自動バックアップ（30日保持）
- R2: バージョニング有効化を推奨

### ログ

- `wrangler tail` でリアルタイムログを確認
- 監査ログはaudit_logsテーブルに保存（管理画面から閲覧可能）
