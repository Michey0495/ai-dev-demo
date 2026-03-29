# PR #247: ショッピングカート機能の追加 -- レビューコメント

レビュアー: 田中（バックエンドリード / 8年目）
レビュー日: 2026-03-21
所要時間: 約20分


## コメント 1

対象: `src/cart/cart-service.ts` L7

```typescript
export async function addItem(userId: string, request: AddItemRequest) {
```

`addItem` だと何に追加するのか不明確。`addItemToCart` に変更してほしい。
同様に `removeItem` → `removeItemFromCart` を推奨。
サービス内の関数であっても、他モジュールからimportされたとき混乱する。

`getCartWithDetails` は主語が明確なのでそのままでよい。


## コメント 2

対象: `src/cart/cart-service.ts` L42

```typescript
import { Cart, CartItem, CartSummary, AddItemRequest } from './types'
```

`Cart` がimportされているのに関数内では使われていない。不要なimportは削除してほしい。


## 総評

カート機能のコア部分としてはシンプルにまとまっている。
上記2点を修正すればLGTM。型定義もきちんと分離されていて良い。
