// ユーザー管理エンドポイント（修正済み）

import { Request, Response } from "express"
import { z } from "zod"
import bcrypt from "bcrypt"
import { getDb } from "./db"

// ユーザー情報の型（レスポンス用 -- passwordカラムを含めない）
interface User {
  id: number
  email: string
  name: string
  created_at: string
}

// [修正: V6] Zodスキーマでバリデーションを定義
const userIdSchema = z.coerce.number().int().positive()

const createUserSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上必要です")
    .regex(/[A-Z]/, "大文字を1文字以上含めてください")
    .regex(/[0-9]/, "数字を1文字以上含めてください"),
  name: z
    .string()
    .min(1, "名前は必須です")
    .max(100, "名前は100文字以内にしてください"),
})

const SALT_ROUNDS = 12

// 全ユーザー一覧取得
export async function listUsersHandler(_req: Request, res: Response) {
  try {
    const db = getDb()
    const users = db.prepare("SELECT id, email, name, created_at FROM users").all()
    return res.json({ users })
  } catch (error) {
    // [修正: V7] 内部エラーの詳細をクライアントに返さない
    console.error("ユーザー一覧取得エラー:", error)
    return res.status(500).json({ error: "ユーザー一覧の取得に失敗しました" })
  }
}

// 個別ユーザー取得
export async function getUserHandler(req: Request, res: Response) {
  try {
    // [修正: V6] IDパラメータをバリデーション
    const parseResult = userIdSchema.safeParse(req.params.id)
    if (!parseResult.success) {
      return res.status(400).json({ error: "ユーザーIDは正の整数で指定してください" })
    }

    const db = getDb()
    const user = db
      .prepare("SELECT id, email, name, created_at FROM users WHERE id = ?")
      .get(parseResult.data) as User | undefined

    if (!user) {
      return res.status(404).json({ error: "ユーザーが見つかりません" })
    }

    return res.json({ user })
  } catch (error) {
    // [修正: V7] スタックトレースやエラー詳細をクライアントに返さない
    console.error("ユーザー取得エラー:", error)
    return res.status(500).json({ error: "ユーザー取得に失敗しました" })
  }
}

// ユーザー作成（管理者用）
export async function createUserHandler(req: Request, res: Response) {
  // [修正: V6] リクエストボディをZodでバリデーション
  const parseResult = createUserSchema.safeParse(req.body)
  if (!parseResult.success) {
    const messages = parseResult.error.errors.map((e) => e.message)
    return res.status(400).json({ error: "入力内容に問題があります", details: messages })
  }

  const { email, password, name } = parseResult.data

  try {
    const db = getDb()

    // [修正: V4] bcryptでパスワードをハッシュ化して保存
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const result = db
      .prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
      .run(email, hashedPassword, name)

    return res.status(201).json({
      user: { id: result.lastInsertRowid, email, name },
    })
  } catch (error) {
    // [修正: V7] ログにパスワードを含めない。エラー詳細もクライアントに返さない
    console.error("ユーザー作成失敗:", { email, error: (error as Error).message })
    return res.status(500).json({ error: "ユーザー作成に失敗しました" })
  }
}
