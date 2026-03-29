# 07 コードレビュー -- 人間が見落とす致命バグをAIが拾う

## テーマ

ショッピングカート機能のPRに対するコードレビュー。
シニアエンジニアが20分かけたレビューと、AIが30秒で返したレビューを比較する。

## Before（従来の手動レビュー）

経験豊富なシニアエンジニアがdiffを読み、以下を指摘した。

- 関数名の改善提案（addItem → addItemToCart）
- 未使用importの指摘

どれも正しい指摘だが、致命的な問題は全て見逃している。
レビュー時間は約20分。忙しい日の午後、SlackとMTGの合間に実施。

## With AI（Claude Codeによるレビュー）

同じdiffをClaude Codeに投入。30秒で以下を全件検出した。

- XSS脆弱性（dangerouslySetInnerHTMLで未サニタイズ描画 / CWE-79）
- 認証バイパス（デバッグエンドポイントの残留 / CWE-489）
- 競合状態（カート同時更新でLost Update / CWE-362）
- N+1クエリ（ループ内の商品取得で100商品なら100回SQL / CWE-400）
- 入力バリデーション不備（req.bodyの未検証 / CWE-20）
- any型の乱用（4箇所の型安全性崩壊）
- 人間が見つけた命名の問題も含め、CWE番号付き・修正コード付きで網羅

## 体感差

| 項目 | 手動レビュー | AIレビュー |
|------|-------------|-----------|
| 所要時間 | 約20分 | 約30秒 |
| 検出数 | 2件（命名のみ） | 12件（CWE番号付き） |
| Critical検出 | 0件 | 4件（XSS/認証バイパス/N+1/競合状態） |
| セキュリティ指摘 | 0件 | 4件 |
| 修正コード提示 | なし | 全件にサンプルコード付き |

人間のレビューが無価値なのではない。命名の改善提案はAIより適切な場合もある。
問題は、人間が疲労や時間制約で致命的な欠陥を見落とすこと。AIはそこを補完する。

## 手順

1. input/cart-feature.diff を開いて、ショッピングカート機能の変更内容を確認する
2. before/review-comments.md を読んで、シニアエンジニアのレビュー結果を見る
3. with-ai/prompt.md のプロンプトをClaude Codeに投入する
4. expected-output/review-report.md と生成結果を比較する

## ファイル構成

```
07_code-review/
  README.md                    このファイル
  input/
    cart-feature.diff          レビュー対象のPR差分（約200行）
  before/
    review-comments.md         シニアエンジニアの手動レビュー（命名のみ2件）
  with-ai/
    prompt.md                  Claude Code用プロンプトテンプレート
  expected-output/
    review-report.md           AIレビューの模範出力（12件検出、CWE番号付き）
```
