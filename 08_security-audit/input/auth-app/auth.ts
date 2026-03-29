// 認証ロジック: ログインとユーザー登録
// デモ用: 意図的にセキュリティ上の問題を含んでいる

import { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { getDb } from "./db"

// [V5] JWTシークレットをソースコードにハードコード -- CWE-798
// 本来は環境変数から取得すべき
const JWT_SECRET = "FAKE_SECRET_KEY_FOR_DEMO"

// トークンの有効期限
const TOKEN_EXPIRY = "24h"

// ログイン処理
export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "メールアドレスとパスワードは必須です" })
  }

  try {
    const db = getDb()

    // [V3] SQLインジェクション -- CWE-89
    // 文字列結合でクエリを組み立てているため、任意のSQLを注入できる
    // 例: email に ' OR 1=1 -- と入力するとすべてのユーザーが返る
    const query = `SELECT * FROM users WHERE email = '${email}'`
    const user = db.prepare(query).get() as
      | { id: number; email: string; password: string; name: string }
      | undefined

    if (!user) {
      return res.status(401).json({ error: "認証に失敗しました" })
    }

    // [V4] パスワードを平文で比較 -- CWE-256
    // bcrypt等でハッシュ化して保存・比較すべき
    if (user.password !== password) {
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

    // 既存ユーザーチェック（ここもSQLインジェクション脆弱だが、V3と同根なので別カウントしない）
    const existing = db
      .prepare(`SELECT id FROM users WHERE email = '${email}'`)
      .get()

    if (existing) {
      return res.status(409).json({ error: "このメールアドレスは既に登録されています" })
    }

    // [V4と同根] パスワードを平文のまま保存
    const result = db
      .prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
      .run(email, password, name)

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
