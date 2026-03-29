# セキュリティ監査レポート（AI生成 -- 完全版）

対象: auth-app/（認証APIサーバ、Express + TypeScript + better-sqlite3）
監査日: 2026-03-24
手法: 静的コード解析（全5ファイル、約200行）
ツール: Claude Code によるソースコード全量レビュー

---

## 検出された脆弱性 -- 10件


### V1: CORS 全ドメイン許可

ファイル: server.ts 19行目
CWE: CWE-942 -- Permissive Cross-domain Policy with Untrusted Domains
OWASP: A05:2021 Security Misconfiguration
CVSS v3.1: 7.5（High）-- AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N
重大度: High

`cors({ origin: "*" })` で全ドメインからのクロスオリジンリクエストを許可している。

攻撃シナリオ: 攻撃者が `evil-site.example.com` にJavaScriptを仕込み、ログイン済みユーザーがそのページを開くと、ブラウザ経由でAPIを呼び出せる。credentials オプションが true になっていない現状でもレスポンスデータの読み取りは可能で、ユーザー一覧の窃取やヘルスチェック情報を起点とした偵察に使われる。

修正:

```typescript
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL ?? "http://localhost:5173",
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("CORS policy violation"))
    }
  },
  credentials: true,
}))
```


### V2: ログインエンドポイントにレート制限なし

ファイル: server.ts 24行目
CWE: CWE-307 -- Improper Restriction of Excessive Authentication Attempts
OWASP: A07:2021 Identification and Authentication Failures
CVSS v3.1: 7.5（High）-- AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N
重大度: High

ログインエンドポイントに試行回数の制限がない。

攻撃シナリオ: hydra や Burp Suite Intruder で毎秒数百回のログイン試行を送信できる。パスワードが平文保存（V4）と組み合わさることで、辞書攻撃の成功率が跳ね上がる。デモ用パスワード `admin123-DEMO-ONLY` 程度なら数分で突破される。

修正:

```typescript
import rateLimit from "express-rate-limit"

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "ログイン試行回数が上限に達しました。15分後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
})

app.post("/api/login", loginLimiter, loginHandler)
```


### V3: SQLインジェクション

ファイル: auth.ts 29行目、74行目
CWE: CWE-89 -- Improper Neutralization of Special Elements used in an SQL Command
OWASP: A03:2021 Injection
CVSS v3.1: 9.8（Critical）-- AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
重大度: Critical

ログイン処理と登録時の既存ユーザーチェックで、メールアドレスをテンプレートリテラルでSQL文に直接埋め込んでいる。

攻撃シナリオ: emailフィールドに `' OR 1=1 --` を送信すると、WHERE句が常にtrueになり全ユーザーの先頭レコードで認証が成立する。`' UNION SELECT 1, email, password, name, created_at FROM users --` でパスワードカラムの値（V4により平文）を直接抜き出すことも可能。SQLiteの場合、`; DROP TABLE users --` によるテーブル削除は prepare の仕様で防がれるが、データ窃取は防げない。

修正:

```typescript
// loginHandler
const user = db
  .prepare("SELECT * FROM users WHERE email = ?")
  .get(email) as
  | { id: number; email: string; password: string; name: string }
  | undefined

// registerHandler
const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(email)
```


### V4: パスワードの平文保存

ファイル: auth.ts 40行目（比較）、83行目（保存）
CWE: CWE-256 -- Plaintext Storage of a Password
OWASP: A02:2021 Cryptographic Failures
CVSS v3.1: 9.1（Critical）-- AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
重大度: Critical

パスワードをハッシュ化せず平文のままデータベースに格納し、ログイン時も平文同士で比較している。

攻撃シナリオ: V3のSQLインジェクションでパスワードカラムを直接読み取れる。V10のファイルパーミッション不備と組み合わせると、同一サーバ上の別プロセスがDBファイルを開いて全ユーザーのパスワードを取得できる。パスワード再利用率は65%前後という調査結果があり、このアプリのパスワードが他サービスへの不正アクセスに転用されるリスクがある。

修正:

```typescript
import bcrypt from "bcrypt"

const SALT_ROUNDS = 12

// 登録時
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)")
  .run(email, hashedPassword, name)

// ログイン時
const isValid = await bcrypt.compare(password, user.password)
if (!isValid) {
  return res.status(401).json({ error: "認証に失敗しました" })
}
```


### V5: JWTシークレットのハードコード

ファイル: auth.ts 10行目
CWE: CWE-798 -- Use of Hard-coded Credentials
OWASP: A02:2021 Cryptographic Failures
CVSS v3.1: 9.1（Critical）-- AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
重大度: Critical

JWTの署名シークレット `"FAKE_SECRET_KEY_FOR_DEMO"` がソースコードに直書きされている。

攻撃シナリオ: リポジトリにアクセスできる開発者、退職者、CI/CDログを閲覧できる人物がシークレットを知り得る。jwt.sign で任意のペイロード（userId: 1 など）を署名すれば、管理者アカウントになりすませる。GitHub等にpushされた場合、git historyから永続的に取得可能。

修正:

```typescript
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error("環境変数 JWT_SECRET が設定されていません。起動を中止します。")
}
```


### V6: 入力バリデーションなし

ファイル: users.ts 31行目（getUserHandler）、62行目（createUserHandler）
CWE: CWE-20 -- Improper Input Validation
OWASP: A03:2021 Injection
CVSS v3.1: 5.3（Medium）-- AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N
重大度: Medium

ユーザーIDパラメータの型チェック、メールアドレスの形式検証、パスワード強度チェック、名前の長さ制限がすべて欠如している。

攻撃シナリオ: getUserHandler に `/api/users/abc` や `/api/users/-1` を送るとSQLiteが予期しない動作をする可能性がある。createUserHandler に空文字列のemail、1文字のpassword、1MB超の名前を送り込めるため、データ汚染やストレージ消費攻撃が成立する。

修正:

```typescript
import { z } from "zod"

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
```


### V7: エラーメッセージに機密情報を含む

ファイル: users.ts 49-54行目（getUserHandler）、77-85行目（createUserHandler）
CWE: CWE-209 -- Generation of Error Message Containing Sensitive Information
OWASP: A04:2021 Insecure Design
CVSS v3.1: 5.3（Medium）-- AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N
重大度: Medium

getUserHandler のcatchブロックで `err.message` と `err.stack` をレスポンスに含めている。createUserHandler ではログにパスワードを平文で出力している。

攻撃シナリオ: 攻撃者が意図的にエラーを誘発する入力を送り、レスポンスからDBのテーブル構造、ファイルパス、使用ライブラリのバージョンを収集する。この情報が後続の標的型攻撃に利用される。ログに出力されたパスワードは、ログ集約サービス（Datadog, CloudWatch等）経由で広範囲に拡散しうる。

修正:

```typescript
// getUserHandler -- クライアントには汎用メッセージのみ
} catch (error) {
  console.error("ユーザー取得エラー:", error)
  return res.status(500).json({ error: "ユーザー取得に失敗しました" })
}

// createUserHandler -- パスワードはログに絶対出さない
} catch (error) {
  console.error("ユーザー作成失敗:", { email, error: (error as Error).message })
  return res.status(500).json({ error: "ユーザー作成に失敗しました" })
}
```


### V8: CSRF対策の未実装

ファイル: middleware.ts 39-47行目
CWE: CWE-352 -- Cross-Site Request Forgery (CSRF)
OWASP: A01:2021 Broken Access Control
CVSS v3.1: 6.5（Medium）-- AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N
重大度: Medium

csrfProtection ミドルウェアが空実装で `next()` を呼ぶだけ。状態変更リクエストに対するCSRFトークン検証が一切ない。

攻撃シナリオ: Cookie認証を併用する構成の場合、攻撃者のサイトにhidden formを仕込み、ユーザーがそのページを開くだけで `/api/register` や管理系エンドポイントへのPOSTが発火する。ユーザーの意図しないアカウント作成やデータ変更が行われる。

修正:

```typescript
import { doubleCsrf } from "csrf-csrf"

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

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"]
  if (safeMethods.includes(req.method)) {
    return next()
  }
  return doubleCsrfProtection(req, res, next)
}
```


### V9: セキュリティヘッダ未設定・HTTPSリダイレクトなし

ファイル: middleware.ts 52-61行目
CWE: CWE-319 -- Cleartext Transmission of Sensitive Information
OWASP: A02:2021 Cryptographic Failures
CVSS v3.1: 7.4（High）-- AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N
重大度: High

securityHeaders ミドルウェアが空実装。以下のヘッダがすべて欠如している。

- Strict-Transport-Security（HSTS）-- HTTPS強制がないため中間者攻撃でトークン傍受が可能
- X-Content-Type-Options -- MIMEスニッフィングによるXSSの踏み台
- X-Frame-Options -- クリックジャッキング攻撃への無防備
- Content-Security-Policy -- インラインスクリプト実行の制御不能
- Referrer-Policy -- リファラ経由でのトークン漏洩

攻撃シナリオ: 公共Wi-Fiなど信頼できないネットワーク上で、HSTSがないためHTTP通信にダウングレードされ、JWTトークンが平文で傍受される。X-Frame-Optionsの欠如により、攻撃者のサイトにiframeで本アプリを埋め込み、ユーザーにクリックジャッキング攻撃を仕掛けられる。

修正:

```typescript
import helmet from "helmet"

app.use(helmet())
```


### V10: データベースファイルのパーミッション不備

ファイル: db.ts 33行目
CWE: CWE-732 -- Incorrect Permission Assignment for Critical Resource
OWASP: A01:2021 Broken Access Control
CVSS v3.1: 7.1（High）-- AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N
重大度: High

`fs.chmodSync(DB_PATH, 0o666)` でデータベースファイルを全ユーザー読み書き可能に設定している。

攻撃シナリオ: 共有サーバ環境で、別のアプリケーションや別ユーザーのプロセスがDBファイルを直接開ける。V4（平文パスワード）と組み合わせると、SQLite CLIで `SELECT email, password FROM users;` を実行するだけで全認証情報が手に入る。WALファイル（app.db-wal）やSHMファイル（app.db-shm）も同じパーミッションで生成されるため、そちらからもデータを抽出できる。

修正:

```typescript
fs.chmodSync(DB_PATH, 0o600)

// WALファイルとSHMファイルも同様に制限
const walPath = `${DB_PATH}-wal`
const shmPath = `${DB_PATH}-shm`
if (fs.existsSync(walPath)) fs.chmodSync(walPath, 0o600)
if (fs.existsSync(shmPath)) fs.chmodSync(shmPath, 0o600)
```

---

## 重大度別サマリ

| 重大度 | 件数 | 対象 | CVSS範囲 |
|--------|------|------|----------|
| Critical | 3 | V3（SQLインジェクション）, V4（平文パスワード）, V5（ハードコードシークレット） | 9.1 - 9.8 |
| High | 4 | V1（CORS）, V2（レート制限）, V9（セキュリティヘッダ）, V10（ファイルパーミッション） | 7.1 - 7.5 |
| Medium | 3 | V6（入力バリデーション）, V7（情報漏洩）, V8（CSRF） | 5.3 - 6.5 |
| Low | 0 | -- | -- |

## 脆弱性の連鎖リスク

単体で見ると Medium 程度の脆弱性も、組み合わせで致命的になる。

V3 + V4: SQLインジェクションで取得したパスワードが平文なので、即座に他サービスへの不正アクセスに転用可能。ハッシュ化されていれば窃取されてもクラック時間が稼げるが、平文ではその猶予がない。

V10 + V4: ファイルパーミッション不備でDBファイルを直接読める上に、パスワードが平文。ネットワーク経由の攻撃すら不要で、同一マシン上の別プロセスから全認証情報を取得できる。

V5 + V1: JWTシークレットが既知の状態でCORSが全開放だと、攻撃者が任意のトークンを発行し、任意のオリジンからAPIを呼び出せる。認証の仕組み全体が無力化する。

## 追加パッケージ

修正にあたり、以下のパッケージが必要。

```
bcrypt
helmet
express-rate-limit
zod
csrf-csrf
```

型定義:
```
@types/bcrypt
```

## 総合評価

Critical 3件を含む計10件の脆弱性を検出した。

最優先はV3（SQLインジェクション）とV4（平文パスワード）の組み合わせ。この2つが同時に存在するため、認証バイパスから全ユーザーのパスワード窃取まで1ステップで到達する。V5（JWTシークレットのハードコード）も、リポジトリアクセス権を持つ全員がトークン偽造できる状態であり、即時対応が必要。

High 4件はいずれも攻撃の難易度が低く、本番環境では即座に悪用される水準。Medium 3件も防御層の欠如であり、他の脆弱性と連鎖して被害を拡大させる。

全件を修正したコードを fixed/ ディレクトリに格納した。
