# プロンプト: DB設計

以下のプロンプトを Claude Code にそのまま貼り付けて実行する。

---

input/data-requirements.md を読み込んでください。
このファイルには小規模ECサイトのビジネス要件が日本語で書かれています。

要件に基づいて PostgreSQL のデータベーススキーマを設計してください。

設計方針:

- 第3正規形（3NF）を満たすこと。繰り返し項目や推移的関数従属を排除する
- テーブル名・カラム名は英語の snake_case で統一する
- データ型は用途に応じて適切に選択する
  - VARCHAR には桁数を指定する（例: email は VARCHAR(255)）
  - 金額は INTEGER（円単位の整数）
  - 日時は TIMESTAMPTZ（タイムゾーン付き）
- 主キーは SERIAL（UUID は使わない）
- 外部キーは REFERENCES で明示的に定義する
- NOT NULL / UNIQUE / CHECK 制約を漏れなく設定する
  - ステータス値は CHECK 制約で列挙し、想定外の値が入らないようにする
  - 数量や価格にはゼロ以上の CHECK を付ける
- 検索頻度が高いカラム（email, status, FK列, 日時）にインデックスを作成する
- 全テーブルに created_at / updated_at を設け、updated_at はトリガー関数で自動更新する
- 各テーブル・各カラムに COMMENT ON で日本語の説明を付ける
- パスワードは平文保存しない前提のカラム名にする（password_hash）

出力:
1. schema.sql -- テーブル定義・制約・インデックス・トリガー・コメントを含む実行可能な DDL
2. er-diagram.md -- Mermaid erDiagram 記法の ER 図。各カラムにPK/FK/UKを明示し、リレーションのラベルにカーディナリティの説明を添える
