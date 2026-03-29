# プロンプト: 機能仕様書から REST API 仕様を生成する

以下のプロンプトを Claude Code に貼り付けて実行する。

---

```
input/feature-spec.md を読み込み、この機能仕様書に基づいて REST API を設計してください。

出力ファイル:
1. openapi.yaml -- OpenAPI 3.0.3 仕様
2. types.ts -- TypeScript の型定義（Zod スキーマ付き）

## REST 設計原則

URL設計:
- リソース指向（パスに動詞を含めない、名詞の複数形を使う）
- 親子関係はパスのネストで表現する（/projects/:projectId/tasks/:taskId）
- APIバージョニングはURLプレフィックス方式（/api/v1/...）
- リソースIDはパスパラメータで渡す（クエリパラメータではなく）

HTTPメソッド:
- GET: 取得（副作用なし）
- POST: 新規作成
- PATCH: 部分更新
- PUT: 全置換またはべき等な操作（担当者設定、ラベル付与など）
- DELETE: 削除

レスポンス設計:
- 統一エンベロープ -- 単一: { data: T }、一覧: { data: T[], meta: PaginationMeta }
- 作成: 201 + 作成されたリソースを返す
- 更新: 200 + 更新後のリソース全体を返す（クライアントが再取得せずに済む）
- 削除: 204 No Content（ボディなし）
- エラー: RFC 7807 Problem Details 準拠（type, title, status, detail, instance）
- ステータスコードを適切に使い分ける（200, 201, 204, 401, 403, 404, 409, 422, 429）

ページネーション:
- カーソルベース（cursor + limit パラメータ）
- デフォルト20件、最大100件
- meta に nextCursor, hasMore, totalCount を含める

認証:
- Bearer トークン方式（Authorization: Bearer <token>）
- accessToken + refreshToken のペア発行
- JWT を想定

フィルタリング・ソート:
- フィルタはクエリパラメータで表現
- ソートは sort（フィールド名） + order（asc/desc）

データ形式:
- JSON のフィールド名は camelCase で統一
- 日時は ISO 8601 / UTC
- ID は UUID v4

## openapi.yaml の要件

- 全エンドポイントに operationId を付与する
- 全エンドポイントのリクエストボディとレスポンスに example を記載する
- 共通エラーレスポンス（401, 403, 404, 409, 422, 429）を components/responses に定義し、各エンドポイントから $ref で参照する
- 429 TooManyRequests のレスポンスに Retry-After / X-RateLimit-* ヘッダーを定義する
- パラメータのバリデーション（minLength, maxLength, minimum, maximum, pattern, format）を漏れなく定義する
- スキーマの required フィールドを正確に指定する
- タグでリソースごとにグルーピング

## types.ts の要件

- 全ての型に対応する Zod スキーマを定義する（型とスキーマの二重管理を避けるため z.infer<typeof schema> で型を導出する）
- UUID, DateTimeString, DateString は Zod のカスタムバリデーション付き
- ページネーションレスポンスとシングルレスポンスはジェネリクスで汎用化
- ユニオン型（ステータス、優先度、ロール）は z.enum で定義
- ステータス遷移ルールを定数 + 判定関数として実装する
- HEXカラーコードは正規表現でバリデーション
```

---

このプロンプトは input/ フォルダの feature-spec.md を参照する前提で書かれている。
Claude Code のワーキングディレクトリをこのテーマのフォルダに設定してから実行すること。

before/api-routes.md との比較ポイント:
- 動詞入りパスがリソース指向パスに変わる
- 全 POST だった操作が GET/POST/PATCH/PUT/DELETE に分かれる
- バラバラだったレスポンス形式が統一エンベロープになる
- 全件返却がカーソルベースページネーションに変わる
- 「なんかエラー」が RFC 7807 構造化エラーに変わる
- 独自ヘッダーが標準 Bearer 認証に変わる
- 生の文字列型が Zod バリデーション付き型に変わる
