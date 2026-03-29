// データ変換 -- 副作用なしの純粋関数群

import type { RawRecord, CustomerRecord } from './types';
import { PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from './constants';

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[-\s()]/g, '');

  if (digits.length === PHONE_MAX_DIGITS) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === PHONE_MIN_DIGITS) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

export function calculateAge(birthDateStr: string): number {
  const birthDate = new Date(birthDateStr);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

export function transformRecord(record: RawRecord): CustomerRecord {
  return {
    name: record['名前'].trim(),
    email: record['メールアドレス'].trim().toLowerCase(),
    phone: normalizePhone(record['電話番号']),
    prefecture: record['都道府県'].trim(),
    birthDate: record['生年月日'],
    age: calculateAge(record['生年月日']),
    amount: Number(record['金額']),
    importedAt: new Date().toISOString(),
  };
}
