// バリデーション -- Zodスキーマで宣言的にルール定義
// エラー時は「どのフィールドが」「なぜ」失敗したか返す

import { z } from 'zod';
import {
  NAME_MAX_LENGTH,
  PHONE_MIN_DIGITS,
  PHONE_MAX_DIGITS,
  AGE_MIN,
  AGE_MAX,
  AMOUNT_MIN,
  AMOUNT_MAX,
  EMAIL_DOMAIN_MIN_LENGTH,
} from './constants';
import type { RawRecord, ValidationError } from './types';

function calculateAgeForValidation(birthDateStr: string): number {
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const phoneDigitsSchema = z
  .string()
  .min(1, { message: '電話番号は必須です' })
  .refine(
    (val) => {
      const digits = val.replace(/[-\s()]/g, '');
      return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    },
    { message: `電話番号は${PHONE_MIN_DIGITS}〜${PHONE_MAX_DIGITS}桁にしてください` }
  )
  .refine(
    (val) => /^\d+$/.test(val.replace(/[-\s()]/g, '')),
    { message: '電話番号に数字以外が含まれています' }
  );

const emailSchema = z
  .string()
  .min(1, { message: 'メールアドレスは必須です' })
  .refine((val) => val.includes('@'), {
    message: 'メールアドレスの形式が不正です',
  })
  .refine((val) => val.includes('.'), {
    message: 'メールアドレスの形式が不正です',
  })
  .refine(
    (val) => {
      const parts = val.split('@');
      return parts.length === 2 && parts[1].length >= EMAIL_DOMAIN_MIN_LENGTH;
    },
    { message: 'メールアドレスのドメインが不正です' }
  );

const birthDateSchema = z
  .string()
  .min(1, { message: '生年月日は必須です' })
  .refine(
    (val) => !isNaN(new Date(val).getTime()),
    { message: '生年月日の形式が不正です' }
  )
  .refine(
    (val) => {
      const age = calculateAgeForValidation(val);
      return age >= AGE_MIN && age <= AGE_MAX;
    },
    { message: `年齢は${AGE_MIN}歳以上${AGE_MAX}歳以下にしてください` }
  );

const amountSchema = z
  .string()
  .min(1, { message: '金額は必須です' })
  .refine((val) => !isNaN(Number(val)), {
    message: '金額は数値で入力してください',
  })
  .refine(
    (val) => {
      const n = Number(val);
      return n >= AMOUNT_MIN && n <= AMOUNT_MAX;
    },
    { message: `金額は${AMOUNT_MIN}〜${AMOUNT_MAX}の範囲にしてください` }
  );

const csvRecordSchema = z.object({
  名前: z
    .string()
    .min(1, { message: '名前は必須です' })
    .max(NAME_MAX_LENGTH, { message: `名前は${NAME_MAX_LENGTH}文字以内にしてください` }),
  メールアドレス: emailSchema,
  電話番号: phoneDigitsSchema,
  都道府県: z.string().min(1, { message: '都道府県は必須です' }),
  生年月日: birthDateSchema,
  金額: amountSchema,
});

export interface FieldValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
}

// 元のコードは最初の失敗で continue していたため、最初のエラーだけ返す
export function validateRecord(
  record: RawRecord,
  rowNumber: number
): FieldValidationResult {
  const result = csvRecordSchema.safeParse(record);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    row: rowNumber,
    field: issue.path[0]?.toString(),
    message: issue.message,
  }));

  return { valid: false, errors: [errors[0]] };
}

export { csvRecordSchema };
