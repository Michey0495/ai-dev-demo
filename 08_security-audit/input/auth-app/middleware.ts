// 認証・セキュリティ系ミドルウェア
// デモ用: 意図的にセキュリティ上の問題を含んでいる

import { Request, Response, NextFunction } from "express"
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

// [V8] CSRF対策が未実装 -- CWE-352
// Cookie認証を併用する場合、CSRFトークンの検証が必要
// 現状では状態変更リクエスト（POST/PUT/DELETE）に対するCSRF保護がない
// 以下はCSRF対策のスタブ。実装されていない
export function csrfProtection(
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  // TODO: CSRF対策を実装する
  // 現状は何もせず次のミドルウェアに渡している
  next()
}

// [V9] セキュリティヘッダが未設定 -- CWE-319
// X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security などがない
// HTTPSリダイレクトも行っていない
export function securityHeaders(
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  // TODO: セキュリティヘッダを設定する
  // TODO: HTTPSリダイレクトを実装する
  // 現状は何も設定せず通過している
  next()
}

// リクエストログ
export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
}
