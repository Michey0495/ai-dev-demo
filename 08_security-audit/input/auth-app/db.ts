// SQLiteデータベース初期化
// デモ用: 意図的にセキュリティ上の問題を含んでいる

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"

const DB_PATH = path.join(__dirname, "app.db")

let db: Database.Database | null = null

// データベース初期化
export function initDb(): void {
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

  // [V10] データベースファイルのパーミッションが全ユーザー読み書き可能 -- CWE-732
  // 本来は所有者のみ読み書き可能（0o600）にすべき
  // 他のユーザーやプロセスからDBファイルを直接読み取られる危険がある
  fs.chmodSync(DB_PATH, 0o666)

  // デモ用初期データ挿入
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number
  }

  if (userCount.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users (email, password, name) VALUES (?, ?, ?)"
    )

    // デモ用ダミーデータ（本物のパスワードではない）
    insertUser.run("admin@example.com", "admin123-DEMO-ONLY", "管理者")
    insertUser.run("user@example.com", "password-DEMO-ONLY", "一般ユーザー")
    insertUser.run("test@example.com", "test1234-DEMO-ONLY", "テストユーザー")
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
