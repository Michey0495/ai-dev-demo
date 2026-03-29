// 認証APIサーバのエントリポイント（修正済み）

import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { loginHandler, registerHandler } from "./auth"
import { getUserHandler, listUsersHandler } from "./users"
import { authMiddleware, csrfProtection } from "./middleware"
import { initDb } from "./db"

const app = express()
const PORT = 3000

// JSON解析
app.use(express.json())

// [修正: V9] helmet でセキュリティヘッダを一括設定
// X-Content-Type-Options, X-Frame-Options, HSTS, CSP 等を自動付与
app.use(helmet())

// [修正: V1] CORSを許可ドメインのホワイトリスト方式に変更
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL ?? "http://localhost:5173",
]

app.use(cors({
  origin: (origin, callback) => {
    // サーバ間通信（originなし）または許可リスト内のオリジンのみ通す
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("CORS policy violation"))
    }
  },
  credentials: true,
}))

// [修正: V2] ログインエンドポイントにレート制限を設定
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 5,                    // 最大5回
  message: { error: "ログイン試行回数が上限に達しました。15分後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
})

// [修正: V8] CSRF対策を状態変更エンドポイントに適用
app.use("/api", csrfProtection)

// 公開エンドポイント（レート制限付き）
app.post("/api/login", loginLimiter, loginHandler)
app.post("/api/register", loginLimiter, registerHandler)

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
