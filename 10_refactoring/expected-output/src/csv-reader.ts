// CSV読み込みとパース -- ファイルIOをこのモジュールに閉じ込める

import * as fs from 'fs';
import { REQUIRED_HEADERS } from './constants';
import type { ParsedCSV, RawRecord } from './types';

function parseLine(line: string): ReadonlyArray<string> {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (const char of line) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

function validateHeaders(headers: ReadonlyArray<string>): string | null {
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      return required;
    }
  }
  return null;
}

export function readCSV(filePath: string): ParsedCSV {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ファイルが見つかりません: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('データ行がありません');
  }

  const headers = parseLine(lines[0]);

  const missingHeader = validateHeaders(headers);
  if (missingHeader !== null) {
    throw new Error(`必須ヘッダーがありません: ${missingHeader}`);
  }

  const rows: RawRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    const record: Record<string, string> = {};
    for (let k = 0; k < headers.length; k++) {
      record[headers[k]] = k < fields.length ? fields[k] : '';
    }
    rows.push(record as RawRecord);
  }

  return { headers, rows };
}

export { parseLine, validateHeaders };
