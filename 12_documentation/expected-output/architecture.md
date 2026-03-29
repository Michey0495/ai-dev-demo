# アーキテクチャ概要

Express + Prisma による3層構成のREST API。ルーティング層、ミドルウェア層、データアクセス層に分離し、ロールベースのアクセス制御と構造化ログを備える。


## コンポーネント構成

```mermaid
graph TB
    Client[クライアント]

    subgraph Express Application
        Server[server.ts<br/>エントリーポイント]

        subgraph Global Middleware
            Helmet[helmet<br/>セキュリティヘッダー]
            CORS[cors<br/>クロスオリジン制御]
            RateLimit[express-rate-limit<br/>レート制限]
            JSON[express.json<br/>ボディパース]
            Logger[middleware/logger.ts<br/>構造化ログ]
        end

        subgraph Route Middleware
            AuthMW[middleware/auth.ts<br/>JWT認証 + ロール制御]
            ValidMW[middleware/validation.ts<br/>Zodバリデーション]
        end

        subgraph Routes
            AuthRoute[routes/auth.ts<br/>認証]
            ProductRoute[routes/products.ts<br/>商品]
            OrderRoute[routes/orders.ts<br/>注文]
            CategoryRoute[routes/categories.ts<br/>カテゴリ]
        end

        subgraph Utilities
            Errors[utils/errors.ts<br/>エラーハンドリング]
            Tax[utils/tax.ts<br/>税計算・送料計算]
            Types[types/index.ts<br/>型定義]
        end

        DB[db/prisma.ts<br/>Prismaクライアント]
    end

    Database[(PostgreSQL)]

    Client --> Server
    Server --> Helmet
    Server --> CORS
    Server --> RateLimit
    Server --> JSON
    Server --> Logger
    Server --> AuthRoute
    Server --> ProductRoute
    Server --> OrderRoute
    Server --> CategoryRoute
    AuthRoute --> ValidMW
    AuthRoute --> AuthMW
    AuthRoute --> DB
    ProductRoute --> AuthMW
    ProductRoute --> ValidMW
    ProductRoute --> DB
    OrderRoute --> AuthMW
    OrderRoute --> ValidMW
    OrderRoute --> Tax
    OrderRoute --> DB
    CategoryRoute --> AuthMW
    CategoryRoute --> ValidMW
    CategoryRoute --> DB
    AuthMW --> DB
    DB --> Database
    AuthRoute --> Errors
    ProductRoute --> Errors
    OrderRoute --> Errors
    CategoryRoute --> Errors
```


## リクエスト処理フロー

認証とロール制御が必要なエンドポイント（例: POST /api/products）にリクエストが到達してからレスポンスが返るまでの流れ。

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as Express Server
    participant RL as Rate Limiter
    participant H as helmet / cors
    participant L as Logger
    participant A as auth middleware
    participant RO as requireRole
    participant V as validation middleware
    participant R as Route Handler
    participant P as Prisma
    participant DB as PostgreSQL

    C->>S: HTTP リクエスト
    S->>RL: レート制限チェック

    alt 制限超過
        RL-->>C: 429 Too Many Requests
    end

    RL->>H: セキュリティヘッダー付与
    H->>L: リクエストログ記録開始
    L->>A: Authorization ヘッダー検証

    alt トークンなし or 不正
        A-->>C: 401 Unauthorized
    end

    A->>P: ユーザー存在確認
    P->>DB: SELECT user
    DB-->>P: user record
    P-->>A: user object
    A->>RO: ロールチェック

    alt ロール権限不足
        RO-->>C: 403 Forbidden
    end

    RO->>V: リクエストボディ検証 (Zod)

    alt バリデーション失敗
        V-->>C: 400 Validation Error
    end

    V->>R: next()
    R->>P: データ操作
    P->>DB: SQL クエリ
    DB-->>P: 結果
    P-->>R: データ

    alt 業務エラー (NotFound, BadRequest, Conflict等)
        R-->>S: AppError throw
        S-->>C: 対応するステータスコード + エラーJSON
    end

    R-->>C: 200/201/204 レスポンス
    Note over L: レスポンスタイムを記録・出力
```


## 注文ステータス遷移

注文は作成時に pending で始まり、以下の経路で遷移する。一度 cancelled または delivered に到達すると、それ以上の遷移はできない。ユーザー自身によるキャンセル（/api/orders/:id/cancel）は pending と confirmed の状態からのみ可能で、キャンセル時に在庫が復元される。

```mermaid
stateDiagram-v2
    [*] --> pending : 注文作成
    pending --> confirmed : 注文確定 (admin)
    pending --> cancelled : キャンセル (admin / user)
    confirmed --> processing : 処理開始 (admin)
    confirmed --> cancelled : キャンセル (admin / user)
    processing --> shipped : 出荷完了 (admin)
    shipped --> delivered : 配達完了 (admin)
    delivered --> [*]
    cancelled --> [*]
```

遷移のルールはコード上で STATUS_TRANSITIONS オブジェクトとして定義されている。

| 現在の状態 | 遷移先 |
|-----------|--------|
| pending | confirmed, cancelled |
| confirmed | processing, cancelled |
| processing | shipped |
| shipped | delivered |
| delivered | なし |
| cancelled | なし |


## 注文作成の処理フロー

注文作成は複数のステップをトランザクション内で実行する。途中で失敗した場合は全ての変更がロールバックされる。

```mermaid
flowchart TD
    A[注文リクエスト受信] --> B[バリデーション]
    B --> C[商品の存在確認]
    C --> D{全商品が存在する?}
    D -- No --> E[404 NotFound]
    D -- Yes --> F[在庫チェック]
    F --> G{在庫は十分?}
    G -- No --> H[400 INSUFFICIENT_STOCK]
    G -- Yes --> I[小計計算]
    I --> J{クーポン指定あり?}
    J -- Yes --> K[クーポン有効性チェック]
    K --> L[割引適用]
    J -- No --> M[割引なし]
    L --> N[税額計算]
    M --> N
    N --> O[送料計算]
    O --> P{送料無料条件を満たす?}
    P -- Yes --> Q[送料 0円]
    P -- No --> R[重量ベースで送料算出]
    Q --> S[トランザクション開始]
    R --> S
    S --> T[注文レコード作成]
    T --> U[在庫減算]
    U --> V[トランザクションコミット]
    V --> W[201 Created レスポンス]
```


## レイヤー間の責務

### server.ts（エントリーポイント）

グローバルミドルウェアの登録、ルーターのマウント、エラーハンドラの設定、サーバー起動を担う。ビジネスロジックは一切含まない。レート制限の設定もここで行う。

### routes/（ルーティング層）

各リソースのエンドポイント定義とビジネスロジック。ミドルウェアチェインの組み立て（認証要否、ロール制限、バリデーションスキーマの指定）もこのレイヤーで行う。注文ルーターは税・送料計算のユーティリティを呼び出し、トランザクションを管理する。

### middleware/（ミドルウェア層）

横断的関心事を処理する。認証ミドルウェアはJWTの検証とユーザー情報のリクエストオブジェクトへの付与、ロールベースのアクセス制御を担当する。バリデーションミドルウェアはZodスキーマに基づくリクエストボディとクエリパラメータの検証を行う。ロガーミドルウェアは全リクエストの構造化ログを出力する。

### db/（データアクセス層）

Prismaクライアントのシングルトン管理。開発環境でのHot Reload時にコネクションが増殖しないよう、グローバル変数にキャッシュする仕組みを持つ。DB接続チェック用のヘルパー関数も提供する。

### utils/（ユーティリティ）

カスタムエラークラス群とExpressエラーハンドラ。AppErrorを基底クラスとし、各HTTPステータスコードに対応するサブクラスを提供する。エラーコード（code）フィールドによりクライアント側での分岐処理が可能。税計算・送料計算のビジネスロジックもここに配置。税率と送料無料閾値は環境変数で調整できる。

### types/（型定義）

プロジェクト全体で共有される型。OrderStatus の string literal union型、JWTペイロードの型、UserRole、各APIの入出力型が定義されている。
