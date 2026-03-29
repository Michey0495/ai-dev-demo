// SQLiteデータベース初期化（修正済み）

import Database from "better-sqlite3"
import bcrypt from "bcrypt"
import fs from "fs"
import path from "path"

const DB_PATH = path.join(__dirname, "app.db")
const SALT_ROUNDS = 12

let db: Database.Database | null = null

// データベース初期化
export async function initDb(): Promise<void> {
  db = new Database(DB_PATH)

  // WALモード有効化（パフォーマンス向上）
  db.pragma("journal_mode = WAL")

  // テーブル作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // [修正: V10] データベースファイルのパーミッションを所有者のみに制限
  // 0o600 = 所有者のみ読み書き可能。他ユーザーはアクセス不可
  fs.chmodSync(DB_PATH, 0o600)

  // WALファイルが存在する場合、そちらのパーミッションも制限
  const walPath = `${DB_PATH}-wal`
  const shmPath = `${DB_PATH}-shm`
  if (fs.existsSync(walPath)) {
    fs.chmodSync(walPath, 0o600)
  }
  if (fs.existsSync(shmPath)) {
    fs.chmodSync(shmPath, 0o600)
  }

  // デモ用初期データ挿入（パスワードはハッシュ化して保存）
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number
  }

  if (userCount.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users (email, password, name) VALUES (?, ?, ?)"
    )

    // デモ用ダミーデータ（bcryptでハッシュ化）
    const demoUsers = [
      { email: "admin@example.com", password: "Admin123-DEMO-ONLY", name: "管理者" },
      { email: "user@example.com", password: "User1234-DEMO-ONLY", name: "一般ユーザー" },
      { email: "test@example.com", password: "Test1234-DEMO-ONLY", name: "テストユーザー" },
    ]

    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS)
      insertUser.run(user.email, hashedPassword, user.name)
    }
  }

  console.log("データベース初期化完了")
}

// データベースインスタンス取得
export function getDb(): Database.Database {
  if (!db) {
    throw new Error("データベースが初期化されていません。initDb()を先に呼んでください。")
  }
  return db
}

// データベースクローズ
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
