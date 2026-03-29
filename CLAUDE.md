# 14AIdevDemo - AI開発デモ集

## 概要
研修・プレゼン用の「従来の開発 vs AI開発」体験デモ集。
12テーマ、各15-20分、Claude Code中心。

## ルール

### コード品質
- デモ用コードも型安全・lint通過を維持
- input/ のデータに本物の機密情報を含めない
- expected-output/ は実際にClaude Codeで生成して検証済みのものだけ配置

### before/ の作り方
- 「意図的に不完全」であること。壊れているのではなく、人間が限られた時間で作った成果物
- 具体的な抜け漏れや非効率さを3-5箇所仕込む
- 致命的ではないが改善余地がある程度に調整

### with-ai/prompt.md
- Claude Codeに貼り付けるだけで動くプロンプト
- input/ のファイルパスを相対参照
- 期待する出力形式を明示

### 命名規則
- フォルダ: XX_kebab-case
- TypeScript: camelCase（変数/関数）、PascalCase（型/interface）
- SQL: snake_case
- ファイル: kebab-case.ext

### テーマ間の独立性
- 各テーマは単独でデモ可能
- テーマ間でimportやファイル参照はしない
- 必要なコードは各テーマのフォルダ内に自己完結
