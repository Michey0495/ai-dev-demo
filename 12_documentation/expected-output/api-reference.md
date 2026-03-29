# APIリファレンス

ベースURL: `http://localhost:4000`


## エンドポイント一覧

| メソッド | パス | 説明 | 認証 | ロール |
|---------|------|------|------|--------|
| POST | /api/auth/register | ユーザー登録 | 不要 | - |
| POST | /api/auth/login | ログイン | 不要 | - |
| POST | /api/auth/refresh | トークンリフレッシュ | 不要 | - |
| GET | /api/auth/me | ログインユーザー情報取得 | 必要 | any |
| GET | /api/products | 商品一覧取得 | 不要 | - |
| GET | /api/products/:id | 商品詳細取得 | 不要 | - |
| POST | /api/products | 商品作成 | 必要 | admin |
| PATCH | /api/products/:id | 商品更新 | 必要 | admin |
| DELETE | /api/products/:id | 商品削除 | 必要 | admin |
| GET | /api/orders | 注文一覧取得 | 必要 | any |
| GET | /api/orders/:id | 注文詳細取得 | 必要 | any |
| POST | /api/orders | 注文作成 | 必要 | any |
| PATCH | /api/orders/:id/status | 注文ステータス更新 | 必要 | admin |
| GET | /api/orders/:id/cancel | 注文キャンセル | 必要 | any |
| GET | /api/categories | カテゴリ一覧取得 | 不要 | - |
| GET | /api/categories/:id | カテゴリ詳細取得 | 不要 | - |
| POST | /api/categories | カテゴリ作成 | 必要 | admin |
| PATCH | /api/categories/:id | カテゴリ更新 | 必要 | admin |
| DELETE | /api/categories/:id | カテゴリ削除 | 必要 | admin |
| GET | /health | ヘルスチェック | 不要 | - |


## 認証

認証が必要なエンドポイントでは、リクエストヘッダーにJWTアクセストークンを含める。

```
Authorization: Bearer <access_token>
```

アクセストークンの有効期限はデフォルトで15分。期限切れの場合は /api/auth/refresh で新しいトークンペアを取得する。リフレッシュトークンの有効期限は7日間。

ロールベースのアクセス制御が適用されるエンドポイントがある。商品とカテゴリの作成・更新・削除、注文のステータス更新は admin ロール限定。注文の閲覧・作成・キャンセルは認証済みユーザーなら誰でも実行できる。


## レート制限

/api/ 配下の全エンドポイントにレート制限が適用される。

- ウィンドウ: 15分（デフォルト）
- 最大リクエスト数: 100回/ウィンドウ（デフォルト）

制限を超えた場合は 429 Too Many Requests が返る。レスポンスヘッダーに `RateLimit-*` 系の標準ヘッダーが含まれる。


---


## 認証 API

### POST /api/auth/register

新規ユーザーを登録し、トークンペアを返す。初期ロールは customer。

リクエスト:

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "山田太郎"
}
```

バリデーション:
- email: 有効なメールアドレス形式（必須）
- password: 8文字以上128文字以下（必須）
- name: 1文字以上100文字以下（必須）

レスポンス: 201 Created

```json
{
  "user": {
    "id": "clxyz1234567890",
    "email": "user@example.com",
    "name": "山田太郎",
    "role": "customer"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

エラー:
- 400: メールアドレスが既に登録されている
- 400: バリデーションエラー


### POST /api/auth/login

メールアドレスとパスワードで認証し、トークンペアを返す。

リクエスト:

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

レスポンス: 200 OK

```json
{
  "user": {
    "id": "clxyz1234567890",
    "email": "user@example.com",
    "name": "山田太郎",
    "role": "customer"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

エラー:
- 401: メールアドレスまたはパスワードが間違っている


### POST /api/auth/refresh

リフレッシュトークンを使って新しいトークンペアを取得する。リフレッシュ時にDBでユーザーの存在確認を行うため、削除済みユーザーのトークンは無効化される。

リクエスト:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

レスポンス: 200 OK

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

エラー:
- 400: refreshTokenが未指定
- 401: リフレッシュトークンが無効または期限切れ
- 401: ユーザーが存在しない


### GET /api/auth/me

認証済みユーザーの情報を取得する。

レスポンス: 200 OK

```json
{
  "id": "clxyz1234567890",
  "email": "user@example.com",
  "name": "山田太郎",
  "role": "customer",
  "createdAt": "2026-03-01T00:00:00.000Z"
}
```

エラー:
- 401: 未認証


---


## 商品 API

### GET /api/products

商品一覧をページネーション付きで取得する。認証不要。

クエリパラメータ:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| page | number | 1 | ページ番号（1以上） |
| limit | number | 20 | 1ページあたりの件数（1~100） |
| category | string | - | カテゴリIDで絞り込み |
| search | string | - | 商品名・説明文のキーワード検索（部分一致、大文字小文字不問） |
| minPrice | number | - | 最低価格で絞り込み |
| maxPrice | number | - | 最高価格で絞り込み |
| sort | string | createdAt | ソート対象（createdAt, price, name, stock） |
| order | string | desc | ソート順（asc, desc） |

レスポンス: 200 OK

```json
{
  "data": [
    {
      "id": "prod_abc123",
      "name": "TypeScript実践ガイド",
      "description": "実務で使えるTypeScriptパターン集",
      "price": 3200,
      "stock": 50,
      "categoryId": "cat_books",
      "sku": "TS-GUIDE-001",
      "weight": 0.5,
      "tags": ["typescript", "programming"],
      "createdAt": "2026-03-20T09:00:00.000Z",
      "updatedAt": "2026-03-20T09:00:00.000Z",
      "category": {
        "id": "cat_books",
        "name": "書籍"
      }
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```


### GET /api/products/:id

指定IDの商品詳細を取得する。認証不要。

レスポンス: 200 OK

レスポンス形式はGET /api/products の配列内要素と同一。

エラー:
- 404: 商品が存在しない


### POST /api/products

商品を新規登録する。admin ロール限定。

リクエスト:

```json
{
  "name": "TypeScript実践ガイド",
  "description": "実務で使えるTypeScriptパターン集",
  "price": 3200,
  "stock": 50,
  "categoryId": "cat_books",
  "sku": "TS-GUIDE-001",
  "weight": 0.5,
  "tags": ["typescript", "programming"]
}
```

バリデーション:
- name: 1文字以上200文字以下（必須）
- description: 2000文字以下（任意）
- price: 正の数値（必須）
- stock: 0以上の整数（必須）
- categoryId: UUID形式（必須）
- sku: 50文字以下（任意）
- weight: 正の数値（任意、単位kg）
- tags: 文字列の配列、各30文字以下、最大10個（任意）

レスポンス: 201 Created

レスポンス形式はGET /api/products/:id と同一。

エラー:
- 400: バリデーションエラー
- 401: 未認証
- 403: adminロールでない


### PATCH /api/products/:id

商品情報を部分更新する。admin ロール限定。

リクエスト（全フィールド任意）:

```json
{
  "price": 2980,
  "stock": 45
}
```

バリデーションはPOSTと同一のスキーマで、全フィールドがoptionalになる。

レスポンス: 200 OK

レスポンス形式はGET /api/products/:id と同一。

エラー:
- 400: バリデーションエラー
- 401: 未認証
- 403: adminロールでない
- 404: 商品が存在しない


### DELETE /api/products/:id

商品を削除する。admin ロール限定。

レスポンス: 204 No Content

エラー:
- 401: 未認証
- 403: adminロールでない
- 404: 商品が存在しない


---


## 注文 API

### GET /api/orders

自分の注文一覧をページネーション付きで取得する。認証済みユーザー自身の注文のみ返される。

クエリパラメータ:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| page | number | 1 | ページ番号（1以上） |
| limit | number | 10 | 1ページあたりの件数（1~50） |
| status | string | - | ステータスで絞り込み |

レスポンス: 200 OK

```json
{
  "data": [
    {
      "id": "order_xyz789",
      "userId": "clxyz1234567890",
      "status": "pending",
      "subtotal": 6400,
      "tax": 640,
      "shippingFee": 0,
      "discount": 0,
      "totalAmount": 7040,
      "shippingAddress": "東京都渋谷区...",
      "couponCode": null,
      "createdAt": "2026-03-24T10:30:00.000Z",
      "updatedAt": "2026-03-24T10:30:00.000Z",
      "items": [
        {
          "id": "item_001",
          "productId": "prod_abc123",
          "quantity": 2,
          "unitPrice": 3200,
          "product": {
            "id": "prod_abc123",
            "name": "TypeScript実践ガイド"
          }
        }
      ]
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

エラー:
- 401: 未認証


### GET /api/orders/:id

自分の注文の詳細を取得する。自分以外のユーザーの注文IDを指定した場合は404になる。

レスポンス: 200 OK

レスポンス形式はGET /api/orders の配列内要素と同一。

エラー:
- 401: 未認証
- 404: 注文が存在しないか、自分の注文ではない


### POST /api/orders

注文を作成する。認証が必要で、任意のロールで実行可能。

作成時に以下の処理がトランザクション内で実行される:
- 全商品の存在確認
- 在庫の充足確認
- クーポンの有効性チェック（指定時）
- 小計の計算
- クーポンによる割引適用
- 税額計算（税率は環境変数で設定、デフォルト10%）
- 送料計算（重量ベース、小計が閾値以上なら送料無料）
- 注文レコード作成と在庫減算の一括実行

リクエスト:

```json
{
  "items": [
    {
      "productId": "prod_abc123",
      "quantity": 2
    },
    {
      "productId": "prod_def456",
      "quantity": 1
    }
  ],
  "shippingAddress": "東京都渋谷区...",
  "couponCode": "SPRING2026"
}
```

バリデーション:
- items: 1件以上50件以下の配列（必須）
  - productId: UUID形式（必須）
  - quantity: 1以上99以下の正の整数（必須）
- shippingAddress: 1文字以上500文字以下（必須）
- couponCode: 20文字以下（任意）

レスポンス: 201 Created

レスポンス形式はGET /api/orders/:id と同一。初期ステータスは "pending"。

エラー:
- 400: バリデーションエラー
- 400: 在庫不足（code: INSUFFICIENT_STOCK、"Insufficient stock for {商品名}"）
- 401: 未認証
- 404: 指定した商品が存在しない


### PATCH /api/orders/:id/status

注文のステータスを更新する。admin ロール限定。

許可されるステータス遷移:

| 現在のステータス | 遷移可能先 |
|----------------|-----------|
| pending | confirmed, cancelled |
| confirmed | processing, cancelled |
| processing | shipped |
| shipped | delivered |
| delivered | （遷移不可） |
| cancelled | （遷移不可） |

リクエスト:

```json
{
  "status": "confirmed"
}
```

レスポンス: 200 OK

レスポンス形式はGET /api/orders/:id と同一。

エラー:
- 400: 許可されていないステータス遷移（code: INVALID_STATUS_TRANSITION）
- 401: 未認証
- 403: adminロールでない
- 404: 注文が存在しない


### GET /api/orders/:id/cancel

自分の注文をキャンセルする。キャンセル可能なステータス（pending, confirmed）の場合のみ実行できる。キャンセル時、トランザクション内で在庫が復元される。

レスポンス: 200 OK

エラー:
- 400: 現在のステータスからキャンセルできない（code: CANCEL_NOT_ALLOWED）
- 401: 未認証
- 404: 注文が存在しないか、自分の注文ではない


---


## カテゴリ API

### GET /api/categories

トップレベルカテゴリの一覧を取得する。認証不要。parentIdがnullのカテゴリのみ返される。名前の昇順でソート。

レスポンス: 200 OK

```json
{
  "data": [
    {
      "id": "cat_books",
      "name": "書籍",
      "slug": "books",
      "description": "技術書・ビジネス書",
      "parentId": null,
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z",
      "_count": {
        "products": 15
      },
      "children": [
        {
          "id": "cat_tech_books",
          "name": "技術書",
          "slug": "tech-books",
          "parentId": "cat_books"
        }
      ]
    }
  ]
}
```


### GET /api/categories/:id

カテゴリ詳細を取得する。認証不要。子カテゴリと直近5件の商品が含まれる。

レスポンス: 200 OK

```json
{
  "id": "cat_books",
  "name": "書籍",
  "slug": "books",
  "description": "技術書・ビジネス書",
  "parentId": null,
  "createdAt": "2026-03-01T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z",
  "_count": {
    "products": 15
  },
  "children": [],
  "products": [
    {
      "id": "prod_abc123",
      "name": "TypeScript実践ガイド",
      "price": 3200,
      "createdAt": "2026-03-20T09:00:00.000Z"
    }
  ]
}
```

エラー:
- 404: カテゴリが存在しない


### POST /api/categories

カテゴリを作成する。admin ロール限定。

リクエスト:

```json
{
  "name": "技術書",
  "slug": "tech-books",
  "description": "プログラミング・インフラ関連書籍",
  "parentId": "cat_books"
}
```

バリデーション:
- name: 1文字以上100文字以下（必須）
- slug: 1文字以上100文字以下、小文字英数字とハイフンのみ（必須）
- description: 500文字以下（任意）
- parentId: UUID形式（任意）

レスポンス: 201 Created

エラー:
- 400: バリデーションエラー
- 401: 未認証
- 403: adminロールでない
- 409: 同じslugのカテゴリが既に存在する


### PATCH /api/categories/:id

カテゴリを更新する。admin ロール限定。

リクエスト（全フィールド任意）:

```json
{
  "name": "プログラミング書籍"
}
```

レスポンス: 200 OK

エラー:
- 400: バリデーションエラー
- 401: 未認証
- 403: adminロールでない
- 404: カテゴリが存在しない


### DELETE /api/categories/:id

カテゴリを削除する。admin ロール限定。商品が紐づいている場合は削除できない。

レスポンス: 204 No Content

エラー:
- 401: 未認証
- 403: adminロールでない
- 404: カテゴリが存在しない
- 409: 商品が紐づいているため削除できない


---


## ヘルスチェック

### GET /health

サーバーの稼働状態を確認する。認証不要。レート制限の対象外。

レスポンス: 200 OK

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-24T10:00:00.000Z"
}
```


---


## エラーレスポンス

### 共通エラー形式

全エンドポイントで統一されたエラーレスポンス形式を使用する。

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

### バリデーションエラー（400）

Zodによるバリデーション失敗時は、フィールド別の詳細情報が付与される。

```json
{
  "error": "Validation Error",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email"
    },
    {
      "field": "password",
      "message": "String must contain at least 8 character(s)"
    }
  ]
}
```

### エラーコード一覧

| code | 意味 |
|------|------|
| NOT_FOUND | リソースが存在しない |
| BAD_REQUEST | リクエストが不正 |
| VALIDATION_ERROR | バリデーションエラー |
| QUERY_VALIDATION_ERROR | クエリパラメータのバリデーションエラー |
| UNAUTHORIZED | 認証が必要、またはトークンが無効 |
| FORBIDDEN | 権限不足 |
| CONFLICT | リソースの競合（slug重複、商品紐づきカテゴリの削除等） |
| INSUFFICIENT_STOCK | 在庫不足 |
| INVALID_STATUS_TRANSITION | 許可されていないステータス遷移 |
| CANCEL_NOT_ALLOWED | キャンセル不可能なステータス |
| INTERNAL_ERROR | 想定外の内部エラー |

### HTTPステータスコード一覧

| コード | 意味 | 発生条件 |
|-------|------|---------|
| 200 | 成功 | 通常のレスポンス |
| 201 | 作成成功 | POST でリソースが作成された場合 |
| 204 | 成功（ボディなし） | DELETE 成功時 |
| 400 | リクエスト不正 | バリデーションエラー、在庫不足、不正なステータス遷移 |
| 401 | 未認証 | トークン未指定、無効、期限切れ、認証情報の不一致 |
| 403 | アクセス禁止 | ロール権限が不足している |
| 404 | リソース未検出 | 指定IDのリソースが存在しない |
| 409 | 競合 | slug重複、商品紐づきカテゴリの削除 |
| 429 | リクエスト過多 | レート制限超過 |
| 500 | サーバーエラー | 想定外の内部エラー |
