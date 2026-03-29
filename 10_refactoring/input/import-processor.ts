// CSV インポート処理 -- 全処理を1関数に詰め込んだモノリシック実装
// 動くが、テスト不能・変更困難・読解に30分かかる

import * as fs from 'fs';

const db = require('../lib/database');
const mailer = require('../lib/mailer');

export async function processCSVImport(filePath: string) {
  let s = 0, f = 0, sk = 0;
  let errors: any[] = [];
  let results: any[] = [];
  try {
    if (!fs.existsSync(filePath)) {
      console.log('ファイルが見つかりません: ' + filePath);
      return { success: false, message: 'ファイルが見つかりません' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length < 2) {
      return { success: false, message: 'データ行がありません' };
    }
    // ヘッダーパース
    let headers: any = [];
    let tmp = '';
    let q = false;
    for (let i = 0; i < lines[0].length; i++) {
      if (lines[0][i] === '"') { q = !q; }
      else if (lines[0][i] === ',' && !q) { headers.push(tmp.trim()); tmp = ''; }
      else { tmp += lines[0][i]; }
    }
    headers.push(tmp.trim());
    // 必須ヘッダーチェック
    if (headers.indexOf('名前') === -1 || headers.indexOf('メールアドレス') === -1 ||
        headers.indexOf('電話番号') === -1 || headers.indexOf('都道府県') === -1 ||
        headers.indexOf('生年月日') === -1 || headers.indexOf('金額') === -1) {
      return { success: false, message: '必須ヘッダーがありません' };
    }
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      // 行パース（ヘッダーと同じロジックをもう一度書く）
      let fields: any = [];
      let c = '';
      let inQ = false;
      for (let j = 0; j < lines[i].length; j++) {
        if (lines[i][j] === '"') { inQ = !inQ; }
        else if (lines[i][j] === ',' && !inQ) { fields.push(c.trim()); c = ''; }
        else { c += lines[i][j]; }
      }
      fields.push(c.trim());
      if (fields.length !== headers.length) {
        errors.push({ row: i + 1, message: 'フィールド数が一致しません' });
        f++;
        continue;
      }
      let rec: any = {};
      for (let k = 0; k < headers.length; k++) { rec[headers[k]] = fields[k]; }

      // バリデーション -- 7段ネスト
      if (!rec['名前'] || rec['名前'].length === 0) {
        errors.push({ row: i + 1, field: '名前', message: '名前は必須です' });
        f++; continue;
      } else {
        if (rec['名前'].length > 50) {
          errors.push({ row: i + 1, field: '名前', message: '名前は50文字以内にしてください' });
          f++; continue;
        }
      }
      if (!rec['メールアドレス'] || rec['メールアドレス'].length === 0) {
        errors.push({ row: i + 1, field: 'メールアドレス', message: 'メールアドレスは必須です' });
        f++; continue;
      } else {
        if (rec['メールアドレス'].indexOf('@') === -1) {
          errors.push({ row: i + 1, field: 'メールアドレス', message: 'メールアドレスの形式が不正です' });
          f++; continue;
        } else {
          if (rec['メールアドレス'].indexOf('.') === -1) {
            errors.push({ row: i + 1, field: 'メールアドレス', message: 'メールアドレスの形式が不正です' });
            f++; continue;
          } else {
            const p = rec['メールアドレス'].split('@');
            if (p.length !== 2 || p[1].length < 3) {
              errors.push({ row: i + 1, field: 'メールアドレス', message: 'メールアドレスのドメインが不正です' });
              f++; continue;
            }
          }
        }
      }
      if (!rec['電話番号'] || rec['電話番号'].length === 0) {
        errors.push({ row: i + 1, field: '電話番号', message: '電話番号は必須です' });
        f++; continue;
      } else {
        const pc = rec['電話番号'].replace(/[-\s\(\)]/g, '');
        if (pc.length < 10 || pc.length > 11) {
          errors.push({ row: i + 1, field: '電話番号', message: '電話番号は10〜11桁にしてください' });
          f++; continue;
        }
        if (!/^\d+$/.test(pc)) {
          errors.push({ row: i + 1, field: '電話番号', message: '電話番号に数字以外が含まれています' });
          f++; continue;
        }
      }
      if (!rec['都道府県'] || rec['都道府県'].length === 0) {
        errors.push({ row: i + 1, field: '都道府県', message: '都道府県は必須です' });
        f++; continue;
      }
      if (!rec['生年月日'] || rec['生年月日'].length === 0) {
        errors.push({ row: i + 1, field: '生年月日', message: '生年月日は必須です' });
        f++; continue;
      } else {
        const bd = new Date(rec['生年月日']);
        if (isNaN(bd.getTime())) {
          errors.push({ row: i + 1, field: '生年月日', message: '生年月日の形式が不正です' });
          f++; continue;
        } else {
          // 年齢計算（1回目）
          const t = new Date();
          let a = t.getFullYear() - bd.getFullYear();
          const md = t.getMonth() - bd.getMonth();
          if (md < 0 || (md === 0 && t.getDate() < bd.getDate())) { a--; }
          if (a < 18 || a > 120) {
            errors.push({ row: i + 1, field: '生年月日', message: '年齢は18歳以上120歳以下にしてください' });
            f++; continue;
          }
        }
      }
      if (!rec['金額'] || rec['金額'].length === 0) {
        errors.push({ row: i + 1, field: '金額', message: '金額は必須です' });
        f++; continue;
      } else {
        const amt = Number(rec['金額']);
        if (isNaN(amt)) {
          errors.push({ row: i + 1, field: '金額', message: '金額は数値で入力してください' });
          f++; continue;
        } else {
          if (amt < 100 || amt > 999999) {
            errors.push({ row: i + 1, field: '金額', message: '金額は100〜999999の範囲にしてください' });
            f++; continue;
          }
        }
      }
      // データ変換
      let np = rec['電話番号'].replace(/[-\s\(\)]/g, '');
      if (np.length === 11) { np = np.slice(0, 3) + '-' + np.slice(3, 7) + '-' + np.slice(7); }
      else if (np.length === 10) { np = np.slice(0, 3) + '-' + np.slice(3, 6) + '-' + np.slice(6); }
      // 年齢計算（2回目、同じロジック）
      const bd2 = new Date(rec['生年月日']);
      const now = new Date();
      let age2 = now.getFullYear() - bd2.getFullYear();
      const md2 = now.getMonth() - bd2.getMonth();
      if (md2 < 0 || (md2 === 0 && now.getDate() < bd2.getDate())) { age2--; }
      const transformed: any = {
        name: rec['名前'].trim(), email: rec['メールアドレス'].trim().toLowerCase(),
        phone: np, prefecture: rec['都道府県'].trim(), birthDate: rec['生年月日'],
        age: age2, amount: Number(rec['金額']), importedAt: new Date().toISOString(),
      };
      // 重複チェック
      try {
        const ex = await db.query('SELECT id FROM customers WHERE email = ? OR phone = ?',
          [transformed.email, transformed.phone]);
        if (ex && ex.length > 0) {
          errors.push({ row: i + 1, message: '既存レコードと重複しています（メールまたは電話番号）' });
          sk++; continue;
        }
      } catch (e) {
        console.log('DB重複チェックエラー: ' + e);
        errors.push({ row: i + 1, message: 'DB重複チェック中にエラーが発生しました' });
        f++; continue;
      }
      // DB挿入
      try {
        await db.query(
          'INSERT INTO customers (name, email, phone, prefecture, birth_date, age, amount, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [transformed.name, transformed.email, transformed.phone, transformed.prefecture,
           transformed.birthDate, transformed.age, transformed.amount, transformed.importedAt]);
        s++;
        results.push(transformed);
      } catch (e) {
        console.log('DB挿入エラー: ' + e);
        errors.push({ row: i + 1, message: 'DB挿入中にエラーが発生しました' });
        f++; continue;
      }
    }
    // 失敗通知
    if (errors.length > 0) {
      try {
        const es = errors.map((e: any) => `行${e.row}: ${e.message}`).join('\n');
        await mailer.send({
          to: 'admin@example.com', subject: 'CSVインポート エラー通知',
          body: `CSVインポート処理でエラーが発生しました。\n\nファイル: ${filePath}\n\n--- エラー一覧 ---\n${es}\n\n--- 集計 ---\n成功: ${s}件\n失敗: ${f}件\nスキップ（重複）: ${sk}件`,
        });
      } catch (me) { console.log('メール送信エラー: ' + me); }
    }
    return { success: true, summary: { total: lines.length - 1, success: s, fail: f, skip: sk }, errors, results };
  } catch (e) {
    console.log('予期せぬエラー: ' + e);
    return { success: false, message: '予期せぬエラーが発生しました' };
  }
}
