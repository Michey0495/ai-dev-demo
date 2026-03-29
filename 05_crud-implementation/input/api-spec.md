# ブログ記事API仕様書

## 概要

ブログプラットフォームの記事管理APIを定義する。
記事の作成・取得・更新・削除に加え、タグによる分類と下書き/公開のステータス管理を行う。

## データモデル

### Post（記事）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| id | string (cuid) | 自動 | 一意な識別子 |
| title | string | 必須 | 記事タイトル。最大100文字 |
| content | string | 必須 | 記事本文。長さ制限なし |
| slug | string | 自動 | URLスラッグ。タイトルから自動生成。一意制約あり |
| status | enum | 任意 | "draft" または "published"。デフォルト "draft" |
| authorId | string | 必須 | 著者のID。Authorテーブルへの外部キー |
| tags | Tag[] | 任意 | 紐づくタグの配列。0個以上 |
| createdAt | datetime | 自動 | 作成日時 |
| updatedAt | datetime | 自動 | 更新日時 |

### Author（著者）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| id | string (cuid) | 自動 | 一意な識別子 |
| name | string | 必須 | 著者名 |
| email | string | 必須 | メールアドレス。一意制約あり |

### Tag（タグ）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| id | string (cuid) | 自動 | 一意な識別子 |
| name | string | 必須 | タグ名。一意制約あり |

PostとTagは多対多のリレーション。

## エンドポイント

### GET /posts -- 記事一覧取得

クエリパラメータ:

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| cursor | string | 任意 | ページネーション用カーソル（記事IDを指定） |
| take | number | 任意 | 取得件数。デフォルト20、最大100 |
| status | string | 任意 | "draft" または "published" でフィルタ |
| tag | string | 任意 | タグ名でフィルタ |

レスポンス:

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "記事タイトル",
      "slug": "kiji-title",
      "status": "published",
      "author": { "id": "clx...", "name": "著者名" },
      "tags": [{ "id": "clx...", "name": "TypeScript" }],
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "nextCursor": "clx..." | null
}
```

一覧ではcontentフィールドを返さない（パフォーマンス考慮）。

### GET /posts/:id -- 記事詳細取得

パスパラメータ:

| パラメータ | 型 | 説明 |
|---|---|---|
| id | string | 記事ID |

レスポンス:

contentを含む記事の全フィールドを返す。author、tagsもネストして返す。

存在しない場合は404を返す。

### POST /posts -- 記事作成

リクエストボディ:

```json
{
  "title": "記事タイトル",
  "content": "記事本文...",
  "status": "draft",
  "authorId": "clx...",
  "tags": ["TypeScript", "Prisma"]
}
```

バリデーションルール:
- title: 必須。1文字以上100文字以下
- content: 必須。1文字以上
- status: 任意。"draft" または "published" のいずれか。省略時は "draft"
- authorId: 必須。存在するAuthorのIDであること
- tags: 任意。文字列の配列。各タグは存在しなければ自動作成する

slug生成ルール:
- タイトルを小文字化し、英数字以外をハイフンに置換
- 先頭・末尾のハイフンを除去し、連続するハイフンを1つにまとめる
- 同一slugが既に存在する場合、末尾に "-2", "-3" のようにサフィックスを付与する

成功時は201を返す。authorIdが存在しない場合は400を返す。

### PUT /posts/:id -- 記事更新

リクエストボディ:

```json
{
  "title": "更新後のタイトル",
  "content": "更新後の本文...",
  "status": "published",
  "tags": ["TypeScript", "Next.js"]
}
```

バリデーションルール:
- title: 任意。指定時は1文字以上100文字以下
- content: 任意。指定時は1文字以上
- status: 任意。"draft" または "published"
- tags: 任意。指定時は既存のタグ紐付けを全て解除し、新しい配列で置き換える

titleを変更した場合、slugも再生成する。
存在しない記事の場合は404を返す。成功時は200を返す。

### DELETE /posts/:id -- 記事削除

存在しない記事の場合は404を返す。成功時は204を返す。レスポンスボディはなし。

## エラーレスポンス形式

全エンドポイント共通で以下の形式を使用する。

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "指定された記事が見つかりません"
  }
}
```

エラーコード一覧:

| HTTPステータス | コード | 用途 |
|---|---|---|
| 400 | VALIDATION_ERROR | バリデーション失敗 |
| 400 | INVALID_AUTHOR | 存在しないauthorId |
| 404 | NOT_FOUND | リソースが見つからない |
| 409 | SLUG_CONFLICT | slug生成の競合（リトライ上限到達時） |
| 500 | INTERNAL_ERROR | サーバー内部エラー |
