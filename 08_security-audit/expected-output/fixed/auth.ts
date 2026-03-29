// 認証ロジック: ログインとユーザー登録（修正済み）

import { Request, Response } from "express"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { getDb } from "./db"

// [修正: V5] JWTシークレットを環境変数から取得
// 未設定の場合はアプリケーション起動を拒否する
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error("環境変数 JWT_SECRET が設定されていません。起動を中止します。")
}

// トークンの有効期限
const TOKEN_EXPIRY = "24h"

// パスワードハッシュのコストファクタ
const SALT_ROUNDS = 12

// ログイン処理
export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "メールアドレスとパスワードは必須です" })
  }

  try {
    const db = getDb()

    // [修正: V3] パラメータ化クエリでSQLインジェクションを防止
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as
      | { id: number; email: string; password: string; name: string }
      | undefined

    if (!user) {
      return res.status(401).json({ error: "認証に失敗しました" })
    }

    // [修正: V4] bcryptでハッシュ比較
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: "認証に失敗しました" })
    }

    // JWTトークン発行
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    )

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    console.error("ログインエラー:", error)
    return res.status(500).json({ error: "内部エラーが発生しました" })
  }
}

// ユーザー登録処理
export async function registerHandler(req: Request, res: Response) {
  const { email, password, name } = req.body

  if (!email || !password || !name) {
    return res.status(400).json({ error: "全項目の入力が必要です" })
  }

  try {
    const db = getDb()

    // [修正: V3] パラメータ化クエリ
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email)

    if (existing) {
      return res.status(409).json({ error: "このメールアドレスは既に登録されています" })
    }

    // [修正: V4] bcryptでハッシュ化して保存
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const result = db
      .prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
      .run(email, hashedPassword, name)

    const token = jwt.sign(
      { userId: result.lastInsertRowid, email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    )

    return res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, email, name },
    })
  } catch (error) {
    console.error("登録エラー:", error)
    return res.status(500).json({ error: "内部エラーが発生しました" })
  }
}

// JWTトークン検証（ミドルウェアから呼ばれる）
export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: number; email: string }
}
