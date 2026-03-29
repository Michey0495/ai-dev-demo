# テスト自動生成プロンプト

対象ファイル `./input/date-utils.ts` に対して、Vitestの包括的テストスイートを生成してください。

## 技術仕様

- フレームワーク: Vitest（`import { describe, it, expect } from 'vitest'`）
- テスト記述: 日本語（describe / it のラベルは全て日本語）
- 関数ごとに describe ブロックを分割
- 各テストは独立実行可能（テスト間の状態依存なし）
- 出力: 1ファイル `date-utils.test.ts` に集約

## 対象関数（全10関数を網羅すること）

formatDate, parseDate, addBusinessDays, isHoliday, getNextBusinessDay,
diffInBusinessDays, getQuarter, getFiscalYear, isLeapYear, getLastDayOfMonth

## テスト観点

合計60-80件を目安に、以下の5カテゴリを全関数に対して検討する。

### 1. 正常系
各関数の代表的な入力で期待値が返ることを確認する。
formatDate なら4種のフォーマット全てを検証する。

### 2. 境界値
日付処理で頻出する境界条件を明示的にテストする。
- 月初(1日) / 月末(28,29,30,31日)
- 年末(12/31) / 年始(1/1) の跨ぎ
- 四半期の切り替わり: Q1→Q2(3月末/4月初)、Q2→Q3、Q3→Q4
- 会計年度の境界: 3月31日 vs 4月1日

### 3. うるう年
うるう年の判定ロジックには4つのルールがある。全パターンを検証する。
- 4で割り切れる → うるう年（2024年）
- 100で割り切れる → 平年（1900年）
- 400で割り切れる → うるう年（2000年）
- 上記いずれでもない → 平年（2025年）

2月29日に関しては parseDate と getLastDayOfMonth の両方で、うるう年/平年の挙動を確認する。

### 4. 営業日計算の特殊ケース
addBusinessDays / getNextBusinessDay / diffInBusinessDays で以下をカバーする。
- 金曜+1営業日 = 翌週月曜（週末スキップ）
- 祝日をまたぐ加算（GW、建国記念の日、年末年始）
- 振替休日: 祝日が日曜に当たる場合の翌月曜判定
- 負の営業日数による過去方向の遡行
- 0営業日の場合は同日を返す
- 元のDateオブジェクトが破壊されないこと（不変性）

### 5. 異常系・不正入力
全関数に対し、想定外の入力でエラーがスローされることを確認する。
- `new Date('invalid')` → 無効な日付エラー
- `null`, `undefined` → エラー（`@ts-expect-error` 付与）
- 文字列を Date の代わりに渡す（`@ts-expect-error` 付与）
- 範囲外の月(0, 13)、存在しない日(4/31)
- 小数の営業日数、小数の年・月

### 6. 関数間の整合性
複数の関数を組み合わせた結果が矛盾しないことを検証する。
- `formatDate` → `parseDate` のラウンドトリップ
- `addBusinessDays(start, n)` した結果と `diffInBusinessDays` の逆算が一致する

## 品質基準

- `@ts-expect-error` は型チェック回避が目的の箇所にのみ使用する
- マジックナンバーの曜日（0=日, 1=月 ... 6=土）にはコメントで曜日名を添える
- 祝日テストでは、どの祝日かを it のラベルまたはコメントで明記する
