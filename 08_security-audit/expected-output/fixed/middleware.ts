// 認証・セキュリティ系ミドルウェア（修正済み）

import { Request, Response, NextFunction } from "express"
import { doubleCsrf } from "csrf-csrf"
import { verifyToken } from "./auth"

// 認証済みリクエストの型拡張
interface AuthenticatedRequest extends Request {
  user?: { userId: number; email: string }
}

// JWT認証ミドルウェア
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "認証トークンが必要です" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: "無効なトークンです" })
  }
}

// [修正: V8] CSRFトークン検証を実装
// doubleCsrf パターン: CookieとヘッダのCSRFトークンを照合する
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? "DEMO-CSRF-SECRET-CHANGE-IN-PRODUCTION",
  cookieName: "__csrf",
  cookieOptions: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  },
  getTokenFromRequest: (req) => req.headers["x-csrf-token"] as string,
})

// GETリクエストはCSRF検証不要、POST/PUT/DELETEのみ検証
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"]
  if (safeMethods.includes(req.method)) {
    return next()
  }
  return doubleCsrfProtection(req, res, next)
}

// CSRFトークン発行エンドポイント用
export { generateToken }

// [修正: V9] セキュリティヘッダの設定はserver.tsでhelmetを使用
// このファイルからsecurityHeaders関数は削除し、helmet に一本化

// リクエストログ
export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const timestamp = new Date().toISOString()
  // リクエストボディはログに含めない（機密情報の漏洩防止）
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
}
