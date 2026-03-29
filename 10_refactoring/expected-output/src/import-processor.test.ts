// 振る舞い保持テスト -- リファクタリング後も元と同じ結果を返すか検証する

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCSVImport } from './import-processor';
import type { DatabaseClient } from './duplicate-checker';
import type { MailClient } from './notifier';

vi.mock('./csv-reader', () => ({
  readCSV: vi.fn(),
}));

import { readCSV } from './csv-reader';
const mockReadCSV = vi.mocked(readCSV);

function createMockDb(overrides: Partial<DatabaseClient> = {}): DatabaseClient {
  return {
    query: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createMockMailer(overrides: Partial<MailClient> = {}): MailClient {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function validRawRecord(overrides: Record<string, string> = {}) {
  return {
    '名前': '田中太郎',
    'メールアドレス': 'tanaka@example.com',
    '電話番号': '090-1234-5678',
    '都道府県': '東京都',
    '生年月日': '1990-05-15',
    '金額': '10000',
    ...overrides,
  };
}

describe('processCSVImport', () => {
  let db: DatabaseClient;
  let mailer: MailClient;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    mailer = createMockMailer();
  });

  // --- 正常系 ---

  it('有効なレコード1件で成功件数1', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord()],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.success).toBe(true);
    expect(result.summary?.success).toBe(1);
    expect(result.summary?.fail).toBe(0);
    expect(result.summary?.skip).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results?.[0].name).toBe('田中太郎');
    expect(result.results?.[0].email).toBe('tanaka@example.com');
  });

  it('複数の有効なレコードを処理できる', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [
        validRawRecord(),
        validRawRecord({
          '名前': '鈴木花子',
          'メールアドレス': 'suzuki@example.com',
          '電話番号': '080-9876-5432',
        }),
      ],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.success).toBe(2);
    expect(result.summary?.total).toBe(2);
  });

  it('メールアドレスが小文字化され、電話番号がハイフン付きに正規化される', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [
        validRawRecord({
          'メールアドレス': '  TANAKA@EXAMPLE.COM  ',
          '電話番号': '09012345678',
          '都道府県': '  東京都  ',
        }),
      ],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    const record = result.results?.[0];
    expect(record?.email).toBe('tanaka@example.com');
    expect(record?.phone).toBe('090-1234-5678');
    expect(record?.prefecture).toBe('東京都');
  });

  // --- バリデーションエラー ---

  it('名前が空なら失敗', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ '名前': '' })],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.summary?.success).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].field).toBe('名前');
  });

  it('メールアドレスに@がなければ失敗', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ 'メールアドレス': 'invalid-email' })],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.errors?.[0].field).toBe('メールアドレス');
  });

  it('電話番号が9桁以下なら失敗', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ '電話番号': '123456789' })],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.errors?.[0].field).toBe('電話番号');
  });

  it('金額が範囲外なら失敗', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ '金額': '99' })],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.errors?.[0].field).toBe('金額');
  });

  it('18歳未満なら失敗', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ '生年月日': '2020-01-01' })],
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.errors?.[0].field).toBe('生年月日');
  });

  // --- 重複チェック ---

  it('重複レコードはスキップされる', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord()],
    });

    db = createMockDb({
      query: vi.fn().mockResolvedValue([{ id: 1 }]),
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.skip).toBe(1);
    expect(result.summary?.success).toBe(0);
  });

  // --- DBエラー ---

  it('重複チェックでDB障害なら失敗として計上', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord()],
    });

    db = createMockDb({
      query: vi.fn().mockRejectedValue(new Error('Connection lost')),
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.errors?.[0].message).toContain('DB重複チェック中');
  });

  it('DB挿入エラーなら失敗として計上', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord()],
    });

    let callCount = 0;
    db = createMockDb({
      query: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([]);
        return Promise.reject(new Error('Insert failed'));
      }),
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.fail).toBe(1);
    expect(result.errors?.[0].message).toContain('DB挿入中');
  });

  // --- 通知 ---

  it('エラーがあればメール通知が送信される', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ '名前': '' })],
    });

    const mockSend = vi.fn().mockResolvedValue(undefined);
    mailer = { send: mockSend };

    await processCSVImport('/tmp/test.csv', db, mailer);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'CSVインポート エラー通知',
      })
    );
  });

  it('エラーがなければメール通知は送信されない', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord()],
    });

    const mockSend = vi.fn().mockResolvedValue(undefined);
    mailer = { send: mockSend };

    await processCSVImport('/tmp/test.csv', db, mailer);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('メール送信が失敗してもインポート結果はsuccessで返る', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [validRawRecord({ '名前': '' })],
    });

    mailer = { send: vi.fn().mockRejectedValue(new Error('SMTP error')) };

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.success).toBe(true);
  });

  // --- 複合ケース ---

  it('有効・無効・重複が混在するCSVを正しく集計する', async () => {
    mockReadCSV.mockReturnValue({
      headers: ['名前', 'メールアドレス', '電話番号', '都道府県', '生年月日', '金額'],
      rows: [
        validRawRecord(),
        validRawRecord({ '名前': '' }),
        validRawRecord({
          '名前': '重複太郎',
          'メールアドレス': 'dup@example.com',
          '電話番号': '080-1111-2222',
        }),
      ],
    });

    let queryCallCount = 0;
    db = createMockDb({
      query: vi.fn().mockImplementation(() => {
        queryCallCount++;
        if (queryCallCount === 1) return Promise.resolve([]);
        if (queryCallCount === 2) return Promise.resolve([]);
        if (queryCallCount === 3) return Promise.resolve([{ id: 99 }]);
        return Promise.resolve([]);
      }),
    });

    const result = await processCSVImport('/tmp/test.csv', db, mailer);

    expect(result.summary?.total).toBe(3);
    expect(result.summary?.success).toBe(1);
    expect(result.summary?.fail).toBe(1);
    expect(result.summary?.skip).toBe(1);
  });

  // --- CSVパースエラー ---

  it('readCSVが例外をスローしたら伝搬する', async () => {
    mockReadCSV.mockImplementation(() => {
      throw new Error('ファイルが見つかりません: /tmp/missing.csv');
    });

    await expect(
      processCSVImport('/tmp/missing.csv', db, mailer)
    ).rejects.toThrow('ファイルが見つかりません');
  });
});
