// 定数定義 -- マジックナンバーとハードコード文字列を排除

export const NAME_MAX_LENGTH = 50;
export const PHONE_MIN_DIGITS = 10;
export const PHONE_MAX_DIGITS = 11;
export const AGE_MIN = 18;
export const AGE_MAX = 120;
export const AMOUNT_MIN = 100;
export const AMOUNT_MAX = 999_999;

export const REQUIRED_HEADERS = [
  '名前',
  'メールアドレス',
  '電話番号',
  '都道府県',
  '生年月日',
  '金額',
] as const;

export const EMAIL_DOMAIN_MIN_LENGTH = 3;

export const NOTIFICATION_RECIPIENT = 'admin@example.com';
export const NOTIFICATION_SUBJECT = 'CSVインポート エラー通知';

export function buildNotificationBody(
  filePath: string,
  errorLines: ReadonlyArray<string>,
  successCount: number,
  failCount: number,
  skipCount: number
): string {
  return [
    'CSVインポート処理でエラーが発生しました。',
    '',
    `ファイル: ${filePath}`,
    '',
    '--- エラー一覧 ---',
    errorLines.join('\n'),
    '',
    '--- 集計 ---',
    `成功: ${successCount}件`,
    `失敗: ${failCount}件`,
    `スキップ（重複）: ${skipCount}件`,
  ].join('\n');
}
