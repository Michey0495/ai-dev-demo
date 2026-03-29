# CRUD ルーター実装

## コンテキスト

ブログ記事APIのCRUDルーターを Hono + Prisma + Zod で実装する。
仕様とDBスキーマは以下の2ファイルに定義済み。

- API仕様書: `./input/api-spec.md`
- Prismaスキーマ: `./input/schema.prisma`

## ベースコード

`before/routes.ts` にルート定義のスケルトンがある。TODOコメントを全て実装に置き換えること。

## 技術スタック

- Hono（Expressではない）
- Prisma Client
- Zod（バリデーション）
- TypeScript（any 禁止）

## 実装要件

1. Zod バリデーション
   - 仕様書の制約（文字数制限、必須/任意、enum値）をすべてスキーマに反映
   - safeParse で検証し、失敗時は最初のエラーメッセージを返す

2. カーソルベースのページネーション
   - take + 1 件取得して次ページの有無を判定
   - nextCursor を末尾レコードの id で返す

3. slug 自動生成
   - タイトルを小文字化 → 英数字と日本語以外をハイフンに置換 → 先頭末尾・連続ハイフンを除去
   - 重複時は末尾に -2, -3 ... のサフィックスを付与

4. タグ管理
   - 作成時: connectOrCreate で既存タグを再利用、なければ新規作成
   - 更新時: set: [] で全解除してから connectOrCreate で再接続

5. エラーレスポンス
   - `{ error: { code, message } }` の統一フォーマット
   - 400 VALIDATION_ERROR / 400 INVALID_AUTHOR / 404 NOT_FOUND / 409 SLUG_CONFLICT / 500 INTERNAL_ERROR

6. Prisma の enum 変換
   - API側 "draft"/"published" と Prisma側 DRAFT/PUBLISHED を相互変換するヘルパーを用意
   - レスポンス時に formatPost で変換

7. 一覧の content 除外
   - findMany では select を使い、content を含めない

## 出力

`routes.ts` を1ファイルで出力。import 文から含めること。
コメントは日本語で、変数名・関数名は英語。
