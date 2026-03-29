// CSV インポート処理 v2 -- 途中までリファクタリングを試みた版
// 関数を切り出し始めたが、エラー蓄積の仕組みが壊れている
// 型も中途半端。TODO が散在したまま放置。

import * as fs from 'fs';

const db = require('../lib/database');
const mailer = require('../lib/mailer');

// 型を一部だけ定義（不完全）
interface ImportResult {
  success: boolean;
  message?: string;
  summary?: any;           // TODO: ちゃんと型を書く
  errors?: any[];
  results?: any[];
}

// --- 切り出した関数群 ---

// CSVの1行をパースする（ここは正しく切り出せた）
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuote = !inQuote;
    } else if (line[i] === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += line[i];
    }
  }
  fields.push(current.trim());
  return fields;
}

// バリデーション -- boolean しか返さないため、呼び出し元でエラー詳細が組み立てられない
// 元のコードでは「名前が空」「メールに@がない」等フィールド単位のメッセージを errors に入れていた
// ここで boolean に潰したせいで情報が消えている
function validateEmail(email: string): boolean {
  if (!email || email.length === 0) return false;
  if (email.indexOf('@') === -1) return false;
  if (email.indexOf('.') === -1) return false;
  const parts = email.split('@');
  if (parts.length !== 2 || parts[1].length < 3) return false;
  return true;
}

function validatePhone(phone: string): boolean {
  if (!phone || phone.length === 0) return false;
  const clean = phone.replace(/[-\s\(\)]/g, '');
  if (clean.length < 10 || clean.length > 11) return false;
  if (!/^\d+$/.test(clean)) return false;
  return true;
}

// TODO: fix this later -- 年齢計算が validateRecord と transformRecord で2回走る
function calculateAge(birthDateStr: string): number {
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// 電話番号の正規化
function normalizePhone(phone: string): string {
  let clean = phone.replace(/[-\s\(\)]/g, '');
  if (clean.length === 11) {
    return clean.slice(0, 3) + '-' + clean.slice(3, 7) + '-' + clean.slice(7);
  } else if (clean.length === 10) {
    return clean.slice(0, 3) + '-' + clean.slice(3, 6) + '-' + clean.slice(6);
  }
  return clean; // TODO: ここに来るケースは想定外。異常値なのにそのまま返している
}

// レコードバリデーション -- 致命的なバグ：どのフィールドで失敗したか不明
function validateRecord(record: any): boolean {
  if (!record['名前'] || record['名前'].length === 0 || record['名前'].length > 50) {
    return false;
  }
  if (!validateEmail(record['メールアドレス'])) {
    return false;
  }
  if (!validatePhone(record['電話番号'])) {
    return false;
  }
  if (!record['都道府県'] || record['都道府県'].length === 0) {
    return false;
  }
  if (!record['生年月日'] || record['生年月日'].length === 0) {
    return false;
  }
  const birthDate = new Date(record['生年月日']);
  if (isNaN(birthDate.getTime())) {
    return false;
  }
  const age = calculateAge(record['生年月日']);
  if (age < 18 || age > 120) {  // マジックナンバーがそのまま
    return false;
  }
  if (!record['金額'] || record['金額'].length === 0) {
    return false;
  }
  const amount = Number(record['金額']);
  if (isNaN(amount) || amount < 100 || amount > 999999) {  // ここも
    return false;
  }
  return true;
}

// データ変換 -- 戻り値の型が any のまま
function transformRecord(record: any): any {
  const age = calculateAge(record['生年月日']); // バリデーション時と重複して2度目の計算
  return {
    name: record['名前'].trim(),
    email: record['メールアドレス'].trim().toLowerCase(),
    phone: normalizePhone(record['電話番号']),
    prefecture: record['都道府県'].trim(),
    birthDate: record['生年月日'],
    age: age,
    amount: Number(record['金額']),
    importedAt: new Date().toISOString(),
  };
}

// 重複チェック -- エラーを握りつぶして false を返す致命バグ
// DB障害時に「重複なし」と判定されるため、不正データが挿入される可能性がある
async function checkDuplicate(email: string, phone: string): Promise<boolean> {
  try {
    const existing = await db.query(
      'SELECT id FROM customers WHERE email = ? OR phone = ?',
      [email, phone]
    );
    return existing && existing.length > 0;
  } catch (error) {
    console.log('重複チェックエラー: ' + error);
    return false; // DB障害を「重複なし」として握りつぶす
  }
}

// DB挿入 -- boolean しか返さないため、エラー原因が呼び出し元に伝わらない
async function insertRecord(record: any): Promise<boolean> {
  try {
    await db.query(
      'INSERT INTO customers (name, email, phone, prefecture, birth_date, age, amount, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [record.name, record.email, record.phone, record.prefecture,
       record.birthDate, record.age, record.amount, record.importedAt]
    );
    return true;
  } catch (error) {
    console.log('DB挿入エラー: ' + error);
    return false; // エラー詳細が消える
  }
}

// --- メイン処理 ---

export async function processCSVImport(filePath: string): Promise<ImportResult> {
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let errors: any[] = [];
  let results: any[] = [];

  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'ファイルが見つかりません' };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  if (lines.length < 2) {
    return { success: false, message: 'データ行がありません' };
  }

  const headers = parseLine(lines[0]);

  // 必須ヘッダーチェック -- ハードコードのまま
  const requiredHeaders = ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'];
  for (const h of requiredHeaders) {
    if (!headers.includes(h)) {
      return { success: false, message: '必須ヘッダーがありません: ' + h };
    }
  }

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;

    const fields = parseLine(lines[i]);
    if (fields.length !== headers.length) {
      errors.push({ row: i + 1, message: 'フィールド数が一致しません' });
      failCount++;
      continue;
    }

    const record: any = {};
    headers.forEach((h: any, idx: number) => { record[h] = fields[idx]; });

    // バリデーション -- ここが壊れている
    // boolean しか返らないので「名前が空」なのか「金額が範囲外」なのか判別不能
    if (!validateRecord(record)) {
      errors.push({ row: i + 1, message: 'バリデーションエラー' }); // 元の詳細メッセージが全部消えた
      failCount++;
      continue;
    }

    const transformed = transformRecord(record);

    // 重複チェック -- DB障害時に false が返るので重複を見逃す
    const isDuplicate = await checkDuplicate(transformed.email, transformed.phone);
    if (isDuplicate) {
      skipCount++;
      continue; // BUG: errors に追加し忘れている。通知メールにスキップ理由が載らない
    }

    // DB挿入
    const inserted = await insertRecord(transformed);
    if (inserted) {
      successCount++;
      results.push(transformed);
    } else {
      failCount++;
      // BUG: errors.push を忘れている。メール通知にも件数にもこの失敗が載らない
    }
  }

  // 通知 -- 元のコードから変更なし（唯一壊れていない部分）
  if (errors.length > 0) {
    try {
      const errorSummary = errors.map((e: any) => `行${e.row}: ${e.message}`).join('\n');
      await mailer.send({
        to: 'admin@example.com',
        subject: 'CSVインポート エラー通知',
        body: `CSVインポート処理でエラーが発生しました。\n\nファイル: ${filePath}\n\n--- エラー一覧 ---\n${errorSummary}\n\n--- 集計 ---\n成功: ${successCount}件\n失敗: ${failCount}件\nスキップ（重複）: ${skipCount}件`,
      });
    } catch (mailError) {
      console.log('メール送信エラー: ' + mailError);
    }
  }

  return {
    success: true,
    summary: { total: lines.length - 1, success: successCount, fail: failCount, skip: skipCount },
    errors,
    results,
  };
}
