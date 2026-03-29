// 型定義 -- CSVインポート処理で使用するすべての型を集約
// any は一切使わない。readonly で不変性を保証する。

export interface RawRecord {
  readonly 名前: string;
  readonly メールアドレス: string;
  readonly 電話番号: string;
  readonly 都道府県: string;
  readonly 生年月日: string;
  readonly 金額: string;
  readonly [key: string]: string;
}

export interface CustomerRecord {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly prefecture: string;
  readonly birthDate: string;
  readonly age: number;
  readonly amount: number;
  readonly importedAt: string;
}

export interface ValidationError {
  readonly row: number;
  readonly field?: string;
  readonly message: string;
}

export interface ImportSummary {
  readonly total: number;
  readonly success: number;
  readonly fail: number;
  readonly skip: number;
}

export interface ImportResult {
  readonly success: boolean;
  readonly message?: string;
  readonly summary?: ImportSummary;
  readonly errors?: ReadonlyArray<ValidationError>;
  readonly results?: ReadonlyArray<CustomerRecord>;
}

export interface ParsedCSV {
  readonly headers: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<RawRecord>;
}

export type RowValidationResult =
  | { readonly valid: true; readonly record: RawRecord }
  | { readonly valid: false; readonly error: ValidationError };

export interface DuplicateCheckResult {
  readonly isDuplicate: boolean;
  readonly matchedField?: 'email' | 'phone';
}
