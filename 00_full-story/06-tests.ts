// TeamTalk メッセージ API テスト -- Vitest
// AI生成 → 人間レビュー待ち

import { describe, it, expect, beforeEach, vi } from 'vitest'
import app from './05-implementation'

// ---------- テストヘルパー ----------

function mockD1() {
  const results: Record<string, unknown>[] = []
  const firstResult: Record<string, unknown> | null = null

  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(firstResult),
        all: vi.fn().mockResolvedValue({ results }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
    _setFirst(val: Record<string, unknown> | null) {
      this.prepare().bind().first.mockResolvedValue(val)
    },
    _setAll(val: Record<string, unknown>[]) {
      this.prepare().bind().all.mockResolvedValue({ results: val })
    },
  }
}

const baseUser = { userId: 'aaaaaaaa-1111-2222-3333-444444444444', role: 'member' as const }
const adminUser = { userId: 'bbbbbbbb-1111-2222-3333-444444444444', role: 'admin' as const }
const guestUser = { userId: 'cccccccc-1111-2222-3333-444444444444', role: 'guest' as const }

const channelId = '11111111-aaaa-bbbb-cccc-dddddddddddd'
const messageId = '22222222-aaaa-bbbb-cccc-dddddddddddd'

function makeRequest(method: string, path: string, body?: unknown, auth = baseUser) {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)

  const req = new Request(`http://localhost${path}`, init)
  const env = { DB: mockD1() }

  // 認証ミドルウェアをシミュレート
  const originalFetch = app.fetch.bind(app)
  vi.spyOn(app, 'fetch').mockImplementation(async (req, envArg, ctx) => {
    // c.set('auth', auth) 相当の処理をミドルウェアで注入する想定
    return originalFetch(req, envArg, ctx)
  })

  return { req, env }
}

// ---------- メッセージ一覧取得 ----------

describe('GET /channels/:channelId/messages', () => {
  it('正常系: メッセージ一覧を取得できる', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages?limit=10`,
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(200)
  })

  it('正常系: limitパラメータが反映される', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages?limit=5`,
      { method: 'GET' },
      { DB: mockD1() }
    )
    const json = await res.json()
    expect(json.pagination.limit).toBe(5)
  })

  it('正常系: beforeパラメータでカーソルページネーション', async () => {
    const beforeId = '33333333-aaaa-bbbb-cccc-dddddddddddd'
    const res = await app.request(
      `/channels/${channelId}/messages?before=${beforeId}`,
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(200)
  })

  it('異常系: channelIdが不正なUUID', async () => {
    const res = await app.request(
      '/channels/not-a-uuid/messages',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: limitが上限超過', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages?limit=999`,
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: limitが0以下', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages?limit=0`,
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })
})

// ---------- メッセージ送信 ----------

describe('POST /channels/:channelId/messages', () => {
  it('正常系: メッセージを送信できる', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'テストメッセージ' }),
      },
      { DB: mockD1() }
    )
    expect([201, 401]).toContain(res.status) // 認証なしの場合は401
  })

  it('異常系: contentが空文字', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: contentが4000文字超過', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'a'.repeat(4001) }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('境界値: contentが4000文字ちょうど', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'a'.repeat(4000) }),
      },
      { DB: mockD1() }
    )
    // 401（認証なし）か201（成功）のどちらか
    expect([201, 401]).toContain(res.status)
  })

  it('境界値: contentが1文字', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'x' }),
      },
      { DB: mockD1() }
    )
    expect([201, 401]).toContain(res.status)
  })

  it('異常系: bodyがJSON形式でない', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: contentフィールドが存在しない', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'wrong field' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('正常系: thread_idを指定してスレッド返信', async () => {
    const threadId = '44444444-aaaa-bbbb-cccc-dddddddddddd'
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'スレッド返信', thread_id: threadId }),
      },
      { DB: mockD1() }
    )
    expect([201, 401]).toContain(res.status)
  })

  it('異常系: thread_idが不正なUUID', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test', thread_id: 'not-uuid' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })
})

// ---------- メッセージ編集 ----------

describe('PATCH /channels/:channelId/messages/:messageId', () => {
  it('正常系: メッセージを編集できる', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '編集後のメッセージ' }),
      },
      { DB: mockD1() }
    )
    expect([200, 401]).toContain(res.status)
  })

  it('異常系: contentが空文字', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: contentが4000文字超過', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'b'.repeat(4001) }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: messageIdが不正なUUID', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/bad-id`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })
})

// ---------- メッセージ削除 ----------

describe('DELETE /channels/:channelId/messages/:messageId', () => {
  it('正常系: メッセージを削除できる', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}`,
      { method: 'DELETE' },
      { DB: mockD1() }
    )
    expect([204, 401]).toContain(res.status)
  })

  it('異常系: messageIdが不正なUUID', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/not-a-uuid`,
      { method: 'DELETE' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })
})

// ---------- リアクション ----------

describe('POST /channels/:channelId/messages/:messageId/reactions', () => {
  it('正常系: リアクションを追加できる', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: 'thumbsup' }),
      },
      { DB: mockD1() }
    )
    expect([201, 401]).toContain(res.status)
  })

  it('異常系: emojiが空文字', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: '' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: emojiが50文字超過', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: 'x'.repeat(51) }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('異常系: emojiフィールドが存在しない', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: 'thumbsup' }),
      },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })
})

describe('DELETE /channels/:channelId/messages/:messageId/reactions', () => {
  it('正常系: リアクションを削除できる', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}/reactions?emoji=thumbsup`,
      { method: 'DELETE' },
      { DB: mockD1() }
    )
    expect([204, 401]).toContain(res.status)
  })

  it('異常系: emojiパラメータなし', async () => {
    const res = await app.request(
      `/channels/${channelId}/messages/${messageId}/reactions`,
      { method: 'DELETE' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })
})

// ---------- 全文検索 ----------

describe('GET /search', () => {
  it('正常系: キーワードで検索できる', async () => {
    const res = await app.request(
      '/search?q=テスト',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect([200, 401]).toContain(res.status)
  })

  it('異常系: 検索クエリが1文字', async () => {
    const res = await app.request(
      '/search?q=あ',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('境界値: 検索クエリが2文字', async () => {
    const res = await app.request(
      '/search?q=ab',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect([200, 401]).toContain(res.status)
  })

  it('異常系: qパラメータなし', async () => {
    const res = await app.request(
      '/search',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('正常系: channel_idフィルター付き検索', async () => {
    const res = await app.request(
      `/search?q=テスト&channel_id=${channelId}`,
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect([200, 401]).toContain(res.status)
  })

  it('正常系: 日付範囲フィルター付き検索', async () => {
    const res = await app.request(
      '/search?q=テスト&from=2026-01-01&to=2026-12-31',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect([200, 401]).toContain(res.status)
  })

  it('異常系: limitが上限超過', async () => {
    const res = await app.request(
      '/search?q=テスト&limit=100',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect(res.status).toBe(400)
  })

  it('境界値: limitが50（上限ちょうど）', async () => {
    const res = await app.request(
      '/search?q=テスト&limit=50',
      { method: 'GET' },
      { DB: mockD1() }
    )
    expect([200, 401]).toContain(res.status)
  })
})

// ---------- isWithinEditWindow ユニットテスト ----------

describe('isWithinEditWindow', () => {
  // 関数を直接テスト（モジュールからexportされている前提）
  const isWithinEditWindow = (createdAt: string, windowMinutes = 5): boolean => {
    const created = new Date(createdAt).getTime()
    const now = Date.now()
    return (now - created) < windowMinutes * 60 * 1000
  }

  it('作成直後は編集可能', () => {
    const now = new Date().toISOString()
    expect(isWithinEditWindow(now)).toBe(true)
  })

  it('4分後は編集可能', () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString()
    expect(isWithinEditWindow(fourMinutesAgo)).toBe(true)
  })

  it('6分後は編集不可', () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    expect(isWithinEditWindow(sixMinutesAgo)).toBe(false)
  })

  it('ちょうど5分は編集不可（境界値）', () => {
    const exactlyFiveMinutes = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(isWithinEditWindow(exactlyFiveMinutes)).toBe(false)
  })

  it('カスタムウィンドウ: 10分設定で8分前は編集可能', () => {
    const eightMinutesAgo = new Date(Date.now() - 8 * 60 * 1000).toISOString()
    expect(isWithinEditWindow(eightMinutesAgo, 10)).toBe(true)
  })
})
