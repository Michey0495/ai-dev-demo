// ユーザー管理エンドポイント
// デモ用: 意図的にセキュリティ上の問題を含んでいる

import { Request, Response } from "express"
import { getDb } from "./db"

// ユーザー情報の型
interface User {
  id: number
  email: string
  password: string
  name: string
  created_at: string
}

// 全ユーザー一覧取得
export async function listUsersHandler(_req: Request, res: Response) {
  try {
    const db = getDb()
    const users = db.prepare("SELECT id, email, name, created_at FROM users").all()
    return res.json({ users })
  } catch (error) {
    return res.status(500).json({ error: "ユーザー一覧の取得に失敗しました" })
  }
}

// 個別ユーザー取得
export async function getUserHandler(req: Request, res: Response) {
  try {
    const db = getDb()
    const userId = req.params.id

    // [V6] 入力バリデーションなし -- CWE-20
    // userIdが数値であることを検証していない
    // 不正な値がそのままクエリに渡される
    const user = db
      .prepare("SELECT id, email, name, created_at FROM users WHERE id = ?")
      .get(userId) as User | undefined

    if (!user) {
      return res.status(404).json({ error: "ユーザーが見つかりません" })
    }

    return res.json({ user })
  } catch (error) {
    // [V7] エラーメッセージに機密情報を含む -- CWE-209
    // エラーオブジェクトをそのままレスポンスに含めている
    // DBのテーブル構造やクエリ内容がクライアントに漏洩する
    const err = error as Error
    return res.status(500).json({
      error: "ユーザー取得に失敗しました",
      detail: err.message,
      stack: err.stack,
    })
  }
}

// ユーザー作成（管理者用）
export async function createUserHandler(req: Request, res: Response) {
  // [V6と同根] リクエストボディのバリデーションなし
  // email形式、パスワード強度、name長の検証がない
  const { email, password, name } = req.body

  try {
    const db = getDb()

    const result = db
      .prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
      .run(email, password, name)

    return res.status(201).json({
      user: { id: result.lastInsertRowid, email, name },
    })
  } catch (error) {
    // [V7と同根] デバッグ情報をレスポンスに含める
    const err = error as Error
    console.error("ユーザー作成失敗:", {
      email,
      password, // パスワードをログに出力してしまっている
      error: err.message,
    })
    return res.status(500).json({
      error: "ユーザー作成に失敗しました",
      detail: err.message,
    })
  }
}
