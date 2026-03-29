# 11 レガシーコード解読

## テーマ

コメントなし、docstringなし、変数名は1文字。ドキュメントも存在しない。
こういうPythonコードを前にして、新人エンジニアは何時間かけて何を理解できるか。
AIなら30秒で全関数の意味とデータフローを出力する。その差を体感するデモ。

## 対象コード

売上データ集計パイプライン。6ファイル、約300行。
pandas/numpyを使った典型的な業務コードだが、関数名は `fn1`, `fn2`, `x`, `y`, `z`、
変数名は `df`, `tmp`, `r`, `a`, `b` のみ。

cfg.py でカラム名を1文字にマッピングしているため、
コードを読んでも何のカラムを操作しているか分からない。

## Before（従来手法）

before/investigation-notes.md を参照。

新人エンジニアが丸1日かけて調査した記録。
関数の意味を推測するも、半分以上が間違っている。
calc.py は途中で理解を諦めた。パイプライン全体の流れは把握できなかった。

所要時間: 8時間（うち3時間は間違った仮説の検証）

## After（AI活用）

with-ai/prompt.md をClaude Codeに投入するだけ。

30秒で以下が得られる:
- 全関数の正確な解説
- データフロー図（Mermaid）
- リネーム提案の対応表
- コード品質の問題点と改善策
- 技術的負債のリスク評価

expected-output/analysis.md が模範回答。

## デモ手順

1. input/ のコードを参加者に見せる。「これが引き継いだコードです」
2. 2-3分、参加者に読ませる。「fn1は何をしていますか？」と聞く
3. before/investigation-notes.md を見せる。「新人が1日かけた結果がこれです」
4. with-ai/prompt.md をClaude Codeに投入する
5. 30秒後の出力と before/ を比較する

## ファイル構成

```
11_legacy-reading/
  README.md                   このファイル
  input/
    main.py                   エントリーポイント
    proc.py                   データ加工処理
    calc.py                   各種計算
    viz.py                    出力生成
    util.py                   ユーティリティ
    cfg.py                    設定値
  before/
    investigation-notes.md    新人の調査メモ（丸1日の成果）
  with-ai/
    prompt.md                 Claude Code用プロンプト
  expected-output/
    analysis.md               AI解析の模範回答
```
