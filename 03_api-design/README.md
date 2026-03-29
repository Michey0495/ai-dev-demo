# 03 API設計 -- 仕様書からREST APIを設計する

## テーマ概要

プロダクトマネージャーが書いた機能仕様書を渡し、そこからREST APIを設計するデモ。
入力は「何を作りたいか」であって「どうAPIを切るか」ではない。
AIが REST の慣習、ページネーション、エラーハンドリング、認証まで考慮した OpenAPI 仕様を一発で出す過程を見せる。

所要時間: 15-20分

## Before / After 比較

### Before（人手で急いで作った場合）

before/api-routes.md を参照。典型的な問題を含む。

- パスに動詞が入っている（/api/getTask, /api/deleteTask）
- 単数形と複数形が混在（/api/project vs /api/tasks）
- レスポンス形式がエンドポイントごとにバラバラ
- ページネーション未考慮で全件返却
- エラー時のレスポンス構造が未定義
- 認証の設計が抜けている
- ステータスコードの使い分けが雑（全部200か500）

### After（AIで設計した場合）

expected-output/ を参照。

- リソース指向のパス設計（/api/v1/tasks, /api/v1/projects）
- 統一されたレスポンスエンベロープ
- カーソルベースのページネーション
- RFC 7807 準拠のエラーレスポンス
- Bearer トークン認証 + スコープ設計
- OpenAPI 3.0 仕様として機械可読
- TypeScript 型定義も同時生成

## 手順

1. input/feature-spec.md を開き、タスク管理アプリの機能仕様を確認する
2. before/api-routes.md を見せ、手作業で作った API 設計の問題点を議論する
3. with-ai/prompt.md のプロンプトを Claude Code に投入する
4. 生成された OpenAPI 仕様を expected-output/ と比較する
5. REST 設計原則のどこが改善されたか振り返る

## 学習ポイント

- 機能仕様とAPI仕様は別の文書。AIはこの変換が得意
- REST の慣習（リソース指向、HTTPメソッドの使い分け、ステータスコード）を網羅的に適用できる
- ページネーション、フィルタリング、ソートのパターンを自動で組み込める
- OpenAPI 形式で出力させることで、Swagger UI やコード生成ツールと連携可能

## ファイル構成

```
03_api-design/
  README.md              -- この説明
  input/
    feature-spec.md      -- プロダクト機能仕様書（入力）
  before/
    api-routes.md        -- 人手で作った粗いAPI設計
  with-ai/
    prompt.md            -- Claude Code に渡すプロンプト
  expected-output/
    openapi.yaml         -- 生成されるOpenAPI仕様
    types.ts             -- 生成されるTypeScript型定義
```
