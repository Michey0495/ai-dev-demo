// 通知 -- エラー発生時のメール送信を担当

import {
  NOTIFICATION_RECIPIENT,
  NOTIFICATION_SUBJECT,
  buildNotificationBody,
} from './constants';
import type { ValidationError, ImportSummary } from './types';

export interface MailClient {
  send(options: { to: string; subject: string; body: string }): Promise<void>;
}

// エラーがなければ何もしない。送信失敗は呼び出し元で処理させる。
export async function notifyErrors(
  mailer: MailClient,
  filePath: string,
  errors: ReadonlyArray<ValidationError>,
  summary: ImportSummary
): Promise<void> {
  if (errors.length === 0) return;

  const errorLines = errors.map((e) => `行${e.row}: ${e.message}`);
  const body = buildNotificationBody(
    filePath,
    errorLines,
    summary.success,
    summary.fail,
    summary.skip
  );

  await mailer.send({
    to: NOTIFICATION_RECIPIENT,
    subject: NOTIFICATION_SUBJECT,
    body,
  });
}
