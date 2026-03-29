import { Hono } from 'hono'
import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'

const app = new Hono()
const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Zod バリデーションスキーマ
// ---------------------------------------------------------------------------

const PostStatus = z.enum(['draft', 'published'])

const ListPostsQuerySchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  status: PostStatus.optional(),
  tag: z.string().optional(),
})

const CreatePostBodySchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(100, 'タイトルは100文字以内です'),
  content: z.string().min(1, '本文は必須です'),
  status: PostStatus.default('draft'),
  authorId: z.string().min(1, '著者IDは必須です'),
  tags: z.array(z.string()).default([]),
})

const UpdatePostBodySchema = z.object({
  title: z.string().min(1).max(100, 'タイトルは100文字以内です').optional(),
  content: z.string().min(1).optional(),
  status: PostStatus.optional(),
  tags: z.array(z.string()).optional(),
})

// ---------------------------------------------------------------------------
// エラーレスポンス
// ---------------------------------------------------------------------------

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_AUTHOR'
  | 'NOT_FOUND'
  | 'SLUG_CONFLICT'
  | 'INTERNAL_ERROR'

const errorResponse = (code: ErrorCode, message: string) => ({
  error: { code, message },
})

// ---------------------------------------------------------------------------
// slug 生成
// ---------------------------------------------------------------------------

const toSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

// 重複があればサフィックスを付けて一意にする
const resolveUniqueSlug = async (
  base: string,
  excludeId?: string,
): Promise<string> => {
  const candidates = [base, ...Array.from({ length: 9 }, (_, i) => `${base}-${i + 2}`)]

  for (const slug of candidates) {
    const hit = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (hit === null || (excludeId !== undefined && hit.id === excludeId)) {
      return slug
    }
  }

  throw new Error('SLUG_CONFLICT')
}

// ---------------------------------------------------------------------------
// Prisma の共通 select / include 定義
// ---------------------------------------------------------------------------

const authorAndTags = {
  author: { select: { id: true, name: true } },
  tags: { select: { id: true, name: true } },
} as const

// 一覧用: content を除外
const listSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  ...authorAndTags,
} as const

// ---------------------------------------------------------------------------
// PostStatus の enum 変換
// ---------------------------------------------------------------------------

const toPrismaStatus = (s: string): 'DRAFT' | 'PUBLISHED' =>
  s === 'published' ? 'PUBLISHED' : 'DRAFT'

const toApiStatus = (s: 'DRAFT' | 'PUBLISHED'): string =>
  s === 'PUBLISHED' ? 'published' : 'draft'

const formatPost = <T extends { status: 'DRAFT' | 'PUBLISHED' }>(
  post: T,
): Omit<T, 'status'> & { status: string } => ({
  ...post,
  status: toApiStatus(post.status),
})

// ---------------------------------------------------------------------------
// ルートハンドラ
// ---------------------------------------------------------------------------

// 記事一覧取得
app.get('/posts', async (c) => {
  try {
    const parsed = ListPostsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json(
        errorResponse('VALIDATION_ERROR', parsed.error.issues[0].message),
        400,
      )
    }

    const { cursor, take, status, tag } = parsed.data

    const where: Prisma.PostWhereInput = {
      ...(status !== undefined ? { status: toPrismaStatus(status) } : {}),
      ...(tag !== undefined ? { tags: { some: { name: tag } } } : {}),
    }

    // take + 1 件取得して次ページの有無を判定
    const posts = await prisma.post.findMany({
      where,
      select: listSelect,
      take: take + 1,
      ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    })

    const hasNext = posts.length > take
    const page = hasNext ? posts.slice(0, take) : posts
    const nextCursor = hasNext ? page[page.length - 1].id : null

    return c.json({ data: page.map(formatPost), nextCursor })
  } catch (err) {
    console.error('記事一覧取得に失敗:', err)
    return c.json(errorResponse('INTERNAL_ERROR', 'サーバー内部エラーが発生しました'), 500)
  }
})

// 記事詳細取得
app.get('/posts/:id', async (c) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: c.req.param('id') },
      include: authorAndTags,
    })

    if (post === null) {
      return c.json(errorResponse('NOT_FOUND', '指定された記事が見つかりません'), 404)
    }

    return c.json({ data: formatPost(post) })
  } catch (err) {
    console.error('記事詳細取得に失敗:', err)
    return c.json(errorResponse('INTERNAL_ERROR', 'サーバー内部エラーが発生しました'), 500)
  }
})

// 記事作成
app.post('/posts', async (c) => {
  try {
    const parsed = CreatePostBodySchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json(
        errorResponse('VALIDATION_ERROR', parsed.error.issues[0].message),
        400,
      )
    }

    const { title, content, status, authorId, tags } = parsed.data

    // 著者の存在確認
    const author = await prisma.author.findUnique({
      where: { id: authorId },
      select: { id: true },
    })
    if (author === null) {
      return c.json(errorResponse('INVALID_AUTHOR', '指定された著者が存在しません'), 400)
    }

    // slug 生成
    let slug: string
    try {
      slug = await resolveUniqueSlug(toSlug(title))
    } catch {
      return c.json(
        errorResponse('SLUG_CONFLICT', 'slug の生成に失敗しました。タイトルを変更してください'),
        409,
      )
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        status: toPrismaStatus(status),
        author: { connect: { id: authorId } },
        tags: {
          connectOrCreate: tags.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: authorAndTags,
    })

    return c.json({ data: formatPost(post) }, 201)
  } catch (err) {
    console.error('記事作成に失敗:', err)
    return c.json(errorResponse('INTERNAL_ERROR', 'サーバー内部エラーが発生しました'), 500)
  }
})

// 記事更新
app.put('/posts/:id', async (c) => {
  try {
    const parsed = UpdatePostBodySchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json(
        errorResponse('VALIDATION_ERROR', parsed.error.issues[0].message),
        400,
      )
    }

    const { title, content, status, tags } = parsed.data
    const postId = c.req.param('id')

    // 記事の存在確認
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    })
    if (existing === null) {
      return c.json(errorResponse('NOT_FOUND', '指定された記事が見つかりません'), 404)
    }

    // 更新データの組み立て
    let updateData: Prisma.PostUpdateInput = {
      ...(content !== undefined ? { content } : {}),
      ...(status !== undefined ? { status: toPrismaStatus(status) } : {}),
    }

    // title が変更された場合、slug も再生成
    if (title !== undefined) {
      let slug: string
      try {
        slug = await resolveUniqueSlug(toSlug(title), postId)
      } catch {
        return c.json(
          errorResponse('SLUG_CONFLICT', 'slug の生成に失敗しました。タイトルを変更してください'),
          409,
        )
      }
      updateData = { ...updateData, title, slug }
    }

    // タグ差し替え: 全解除 → 新規接続
    if (tags !== undefined) {
      updateData = {
        ...updateData,
        tags: {
          set: [],
          connectOrCreate: tags.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      }
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: authorAndTags,
    })

    return c.json({ data: formatPost(updated) })
  } catch (err) {
    console.error('記事更新に失敗:', err)
    return c.json(errorResponse('INTERNAL_ERROR', 'サーバー内部エラーが発生しました'), 500)
  }
})

// 記事削除
app.delete('/posts/:id', async (c) => {
  try {
    const postId = c.req.param('id')

    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    })
    if (existing === null) {
      return c.json(errorResponse('NOT_FOUND', '指定された記事が見つかりません'), 404)
    }

    await prisma.post.delete({ where: { id: postId } })

    return c.body(null, 204)
  } catch (err) {
    console.error('記事削除に失敗:', err)
    return c.json(errorResponse('INTERNAL_ERROR', 'サーバー内部エラーが発生しました'), 500)
  }
})

export default app
