// TeamTalk メッセージ CRUD API -- Hono + Zod
// AI生成 → 人間レビュー待ち

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'

// ---------- 型定義 ----------

interface Env {
  DB: D1Database
}

interface AuthPayload {
  userId: string
  role: 'admin' | 'member' | 'guest'
}

// ---------- Zodスキーマ ----------

const uuidSchema = z.string().uuid()

const createMessageSchema = z.object({
  content: z.string().min(1, 'メッセージは空にできません').max(4000, 'メッセージは4000文字以内です'),
  thread_id: z.string().uuid().nullable().optional(),
})

const updateMessageSchema = z.object({
  content: z.string().min(1, 'メッセージは空にできません').max(4000, 'メッセージは4000文字以内です'),
})

const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().uuid().optional(),
})

const searchQuerySchema = z.object({
  q: z.string().min(2, '検索クエリは2文字以上です'),
  channel_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

// ---------- ヘルパー ----------

function getAuth(c: { get: (key: string) => unknown }): AuthPayload {
  const auth = c.get('auth') as AuthPayload | undefined
  if (!auth) {
    throw new HTTPException(401, { message: '認証が必要です' })
  }
  return auth
}

async function verifyChannelAccess(db: D1Database, channelId: string, userId: string): Promise<void> {
  const member = await db
    .prepare('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?')
    .bind(channelId, userId)
    .first()

  if (!member) {
    throw new HTTPException(403, { message: 'このチャンネルへのアクセス権がありません' })
  }
}

async function findMessage(db: D1Database, messageId: string) {
  const message = await db
    .prepare('SELECT * FROM messages WHERE id = ? AND is_deleted = FALSE')
    .bind(messageId)
    .first()

  if (!message) {
    throw new HTTPException(404, { message: 'メッセージが見つかりません' })
  }
  return message
}

function isWithinEditWindow(createdAt: string, windowMinutes = 5): boolean {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  return (now - created) < windowMinutes * 60 * 1000
}

// ---------- ルーター ----------

const app = new Hono<{ Bindings: Env }>()

// エラーハンドリング
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: `HTTP_${err.status}`, message: err.message } },
      err.status
    )
  }
  console.error('Unexpected error:', err)
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'サーバー内部エラーが発生しました' } },
    500
  )
})

// メッセージ一覧取得
app.get(
  '/channels/:channelId/messages',
  zValidator('param', z.object({ channelId: uuidSchema })),
  zValidator('query', listMessagesQuerySchema),
  async (c) => {
    const auth = getAuth(c)
    const { channelId } = c.req.valid('param')
    const { limit, before } = c.req.valid('query')

    await verifyChannelAccess(c.env.DB, channelId, auth.userId)

    let query = `
      SELECT m.*, u.display_name, u.avatar_url
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ? AND m.is_deleted = FALSE
    `
    const params: unknown[] = [channelId]

    if (before) {
      query += ' AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)'
      params.push(before)
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?'
    params.push(limit + 1)

    const result = await c.env.DB
      .prepare(query)
      .bind(...params)
      .all()

    const messages = result.results || []
    const hasMore = messages.length > limit
    const data = hasMore ? messages.slice(0, limit) : messages

    return c.json({
      data: data.reverse(),
      pagination: {
        limit,
        has_more: hasMore,
      },
    })
  }
)

// メッセージ送信
app.post(
  '/channels/:channelId/messages',
  zValidator('param', z.object({ channelId: uuidSchema })),
  zValidator('json', createMessageSchema),
  async (c) => {
    const auth = getAuth(c)
    const { channelId } = c.req.valid('param')
    const body = c.req.valid('json')

    if (auth.role === 'guest') {
      const channel = await c.env.DB
        .prepare('SELECT type FROM channels WHERE id = ?')
        .bind(channelId)
        .first()

      if (!channel || channel.type !== 'public') {
        throw new HTTPException(403, { message: 'ゲストはパブリックチャンネルのみ投稿できます' })
      }
    }

    await verifyChannelAccess(c.env.DB, channelId, auth.userId)

    if (body.thread_id) {
      const parent = await c.env.DB
        .prepare('SELECT id FROM messages WHERE id = ? AND channel_id = ? AND is_deleted = FALSE')
        .bind(body.thread_id, channelId)
        .first()

      if (!parent) {
        throw new HTTPException(400, { message: 'スレッドの親メッセージが見つかりません' })
      }
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await c.env.DB
      .prepare(`
        INSERT INTO messages (id, channel_id, user_id, content, thread_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, channelId, auth.userId, body.content, body.thread_id ?? null, now, now)
      .run()

    const message = await c.env.DB
      .prepare('SELECT m.*, u.display_name, u.avatar_url FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?')
      .bind(id)
      .first()

    return c.json(message, 201)
  }
)

// メッセージ編集
app.patch(
  '/channels/:channelId/messages/:messageId',
  zValidator('param', z.object({ channelId: uuidSchema, messageId: uuidSchema })),
  zValidator('json', updateMessageSchema),
  async (c) => {
    const auth = getAuth(c)
    const { channelId, messageId } = c.req.valid('param')
    const body = c.req.valid('json')

    await verifyChannelAccess(c.env.DB, channelId, auth.userId)

    const message = await findMessage(c.env.DB, messageId)

    if (message.user_id !== auth.userId) {
      throw new HTTPException(403, { message: '自分のメッセージのみ編集できます' })
    }

    if (!isWithinEditWindow(message.created_at as string)) {
      throw new HTTPException(410, { message: '編集可能な時間（5分）を過ぎています' })
    }

    const now = new Date().toISOString()

    await c.env.DB
      .prepare('UPDATE messages SET content = ?, is_edited = TRUE, updated_at = ? WHERE id = ?')
      .bind(body.content, now, messageId)
      .run()

    const updated = await c.env.DB
      .prepare('SELECT m.*, u.display_name, u.avatar_url FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?')
      .bind(messageId)
      .first()

    return c.json(updated)
  }
)

// メッセージ削除（論理削除）
app.delete(
  '/channels/:channelId/messages/:messageId',
  zValidator('param', z.object({ channelId: uuidSchema, messageId: uuidSchema })),
  async (c) => {
    const auth = getAuth(c)
    const { channelId, messageId } = c.req.valid('param')

    await verifyChannelAccess(c.env.DB, channelId, auth.userId)

    const message = await findMessage(c.env.DB, messageId)

    const canDelete = message.user_id === auth.userId || auth.role === 'admin'
    if (!canDelete) {
      throw new HTTPException(403, { message: '削除権限がありません' })
    }

    await c.env.DB
      .prepare('UPDATE messages SET is_deleted = TRUE, updated_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), messageId)
      .run()

    return c.body(null, 204)
  }
)

// リアクション追加
app.post(
  '/channels/:channelId/messages/:messageId/reactions',
  zValidator('param', z.object({ channelId: uuidSchema, messageId: uuidSchema })),
  zValidator('json', z.object({ emoji: z.string().min(1).max(50) })),
  async (c) => {
    const auth = getAuth(c)
    const { messageId } = c.req.valid('param')
    const { emoji } = c.req.valid('json')

    await findMessage(c.env.DB, messageId)

    const existing = await c.env.DB
      .prepare('SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
      .bind(messageId, auth.userId, emoji)
      .first()

    if (existing) {
      throw new HTTPException(409, { message: '同じリアクションは一度だけです' })
    }

    await c.env.DB
      .prepare('INSERT INTO reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), messageId, auth.userId, emoji, new Date().toISOString())
      .run()

    return c.json({ ok: true }, 201)
  }
)

// リアクション削除
app.delete(
  '/channels/:channelId/messages/:messageId/reactions',
  zValidator('param', z.object({ channelId: uuidSchema, messageId: uuidSchema })),
  zValidator('query', z.object({ emoji: z.string().min(1) })),
  async (c) => {
    const auth = getAuth(c)
    const { messageId } = c.req.valid('param')
    const { emoji } = c.req.valid('query')

    await c.env.DB
      .prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
      .bind(messageId, auth.userId, emoji)
      .run()

    return c.body(null, 204)
  }
)

// 全文検索
app.get(
  '/search',
  zValidator('query', searchQuerySchema),
  async (c) => {
    const auth = getAuth(c)
    const { q, channel_id, user_id, from, to, limit, offset } = c.req.valid('query')

    let query = `
      SELECT m.*, u.display_name, u.avatar_url, ch.name as channel_name
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels ch ON m.channel_id = ch.id
      JOIN channel_members cm ON m.channel_id = cm.channel_id AND cm.user_id = ?
      WHERE m.is_deleted = FALSE
        AND m.search_vector @@ plainto_tsquery('japanese', ?)
    `
    const params: unknown[] = [auth.userId, q]

    if (channel_id) {
      query += ' AND m.channel_id = ?'
      params.push(channel_id)
    }
    if (user_id) {
      query += ' AND m.user_id = ?'
      params.push(user_id)
    }
    if (from) {
      query += ' AND m.created_at >= ?'
      params.push(from)
    }
    if (to) {
      query += ' AND m.created_at <= ?'
      params.push(to)
    }

    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM')
    const countResult = await c.env.DB.prepare(countQuery).bind(...params).first()
    const total = (countResult?.total as number) || 0

    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await c.env.DB.prepare(query).bind(...params).all()

    return c.json({
      data: result.results || [],
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    })
  }
)

export default app
