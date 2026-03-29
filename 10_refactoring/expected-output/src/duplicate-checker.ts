// 重複チェック -- エラーは握りつぶさず呼び出し元に伝搬させる

import type { DuplicateCheckResult } from './types';

export interface DatabaseClient {
  query(
    sql: string,
    params: ReadonlyArray<string | number>
  ): Promise<ReadonlyArray<Record<string, unknown>>>;
}

// DB障害時は例外をスローする（意図的に握りつぶさない）
export async function checkDuplicate(
  db: DatabaseClient,
  email: string,
  phone: string
): Promise<DuplicateCheckResult> {
  const existing = await db.query(
    'SELECT id FROM customers WHERE email = ? OR phone = ?',
    [email, phone]
  );

  return existing.length > 0
    ? { isDuplicate: true }
    : { isDuplicate: false };
}
