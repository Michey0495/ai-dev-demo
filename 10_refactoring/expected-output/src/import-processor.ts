// オーケストレータ -- 各モジュールを組み合わせるだけ
// このファイル自身はビジネスロジックを持たない

import { readCSV } from './csv-reader';
import { validateRecord } from './validator';
import { transformRecord } from './transformer';
import { checkDuplicate, type DatabaseClient } from './duplicate-checker';
import { insertCustomer } from './repository';
import { notifyErrors, type MailClient } from './notifier';
import type { ImportResult, ValidationError, CustomerRecord } from './types';

export async function processCSVImport(
  filePath: string,
  db: DatabaseClient,
  mailer: MailClient
): Promise<ImportResult> {
  const { rows } = readCSV(filePath);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const errors: ValidationError[] = [];
  const results: CustomerRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const raw = rows[i];

    const validation = validateRecord(raw, rowNumber);
    if (!validation.valid) {
      errors.push(...validation.errors);
      failCount++;
      continue;
    }

    const record = transformRecord(raw);

    try {
      const { isDuplicate } = await checkDuplicate(db, record.email, record.phone);
      if (isDuplicate) {
        errors.push({ row: rowNumber, message: '既存レコードと重複しています（メールまたは電話番号）' });
        skipCount++;
        continue;
      }
    } catch {
      errors.push({ row: rowNumber, message: 'DB重複チェック中にエラーが発生しました' });
      failCount++;
      continue;
    }

    try {
      await insertCustomer(db, record);
      successCount++;
      results.push(record);
    } catch {
      errors.push({ row: rowNumber, message: 'DB挿入中にエラーが発生しました' });
      failCount++;
    }
  }

  const summary = { total: rows.length, success: successCount, fail: failCount, skip: skipCount };

  try {
    await notifyErrors(mailer, filePath, errors, summary);
  } catch {
    // 通知失敗はインポート結果に影響させない
  }

  return { success: true, summary, errors, results };
}
