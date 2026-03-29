// リポジトリ -- DB操作の関心事を閉じ込める

import type { CustomerRecord } from './types';
import type { DatabaseClient } from './duplicate-checker';

// 失敗時は例外をスロー。成功時は何も返さない。
export async function insertCustomer(
  db: DatabaseClient,
  record: CustomerRecord
): Promise<void> {
  await db.query(
    'INSERT INTO customers (name, email, phone, prefecture, birth_date, age, amount, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      record.name,
      record.email,
      record.phone,
      record.prefecture,
      record.birthDate,
      record.age,
      record.amount,
      record.importedAt,
    ]
  );
}
