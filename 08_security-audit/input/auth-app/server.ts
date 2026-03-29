// 認証APIサーバのエントリポイント
// デモ用: 意図的にセキュリティ上の問題を含んでいる

import express from "express"
import cors from "cors"
import { loginHandler, registerHandler } from "./auth"
import { getUserHandler, listUsersHandler } from "./users"
import { authMiddleware } from "./middleware"
import { initDb } from "./db"

const app = express()
const PORT = 3000

// JSON解析
app.use(express.json())

// [V1] CORSを全ドメインに許可 -- CWE-942
// 本来はホワイトリスト方式で許可ドメインを制限すべき
app.use(cors({ origin: "*" }))

// 公開エンドポイント
// [V2] ログインにレート制限なし -- CWE-307
// ブルートフォース攻撃への耐性がゼロ
app.post("/api/login", loginHandler)
app.post("/api/register", registerHandler)

// 認証が必要なエンドポイント
app.get("/api/users", authMiddleware, listUsersHandler)
app.get("/api/users/:id", authMiddleware, getUserHandler)

// ヘルスチェック
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// サーバ起動
async function startServer() {
  try {
    initDb()
    app.listen(PORT, () => {
      console.log(`サーバ起動: http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("サーバ起動失敗:", error)
    process.exit(1)
  }
}

startServer()

export { app }
