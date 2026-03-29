# 02 DB設計 -- 自然言語からデータベーススキーマを生成する

所要時間: 15-20分


## テーマ概要

業務要件を日本語で書いた文書から、正規化されたPostgreSQLスキーマをAIに生成させる。
人間がゼロから書くとどうしても抜け漏れが出るDB設計を、AIが一発で実用水準に引き上げる過程を体験する。


## フォルダ構成

```
02_db-design/
  input/
    data-requirements.md   -- EC サイトのビジネス要件（自然言語）
  before/
    schema.sql             -- AI なしで書いたスキーマ（アンチパターン入り）
  with-ai/
    prompt.md              -- Claude Code に渡すプロンプト
  expected-output/
    schema.sql             -- AI 生成後の理想スキーマ（3NF）
    er-diagram.md          -- Mermaid 形式の ER 図
```


## Before（AI なし）の問題点

before/schema.sql には、経験の浅い開発者が短時間で書いたスキーマを再現している。
含まれるアンチパターンは5つ。

- カテゴリ名を products テーブルに直接格納している（正規化不足）
- カラム名が camelCase と snake_case で混在している
- 外部キー制約・NOT NULL 制約が欠落している
- インデックスが一切定義されていない
- VARCHAR に桁数指定がなく、TEXT と使い分けされていない


## After（AI あり）の改善点

expected-output/schema.sql では上記の問題がすべて解消されている。

- categories テーブルを分離し、products から外部キーで参照（第3正規形）
- 全カラムが snake_case で統一
- 適切な NOT NULL / UNIQUE / CHECK 制約
- 検索頻度の高いカラムにインデックス
- created_at / updated_at のタイムスタンプ自動管理
- テーブル・カラム単位の COMMENT で日本語説明


## デモ手順

1. input/data-requirements.md を開き、ビジネス要件を確認する
2. before/schema.sql を見せて「手作業だとこうなりがち」と説明する
3. with-ai/prompt.md のプロンプトを Claude Code に貼り付けて実行する
4. 生成結果と expected-output/ を比較し、改善点を解説する
5. Mermaid ER 図でリレーションを視覚的に確認する
