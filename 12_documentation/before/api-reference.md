# API仕様書

最終更新: 2025年9月（たぶん）
作成者: 田中

## 商品

### 商品一覧
GET /api/products

パラメータ:
- page ... ページ番号
- limit ... 件数
- category ... カテゴリで絞り込む
- sort ... ソート（name, price, created_at）
- keyword ... キーワード検索

レスポンス: 200

```json
{
  "products": [...],
  "count": 100
}
```

### 商品作成

POST /api/products

リクエストボディ:
- name (string) 商品名
- price (number) 金額
- stock (number) 在庫
- category (string) カテゴリ名
- tags (string[]) タグ

レスポンス: 200

※要認証


## 注文

### 注文作成

POST /api/orders

リクエストボディ:
- products: 商品IDの配列
- address: 配送先

レスポンス: 200

```
{
  orderId: "xxx",
  status: "new",
  total: 1500
}
```

### 注文一覧

GET /api/orders

パラメータ: page, limit

レスポンス: 200

一覧が返る。自分の注文だけが見えるはず。


## カテゴリ

※カテゴリAPIはまだ仕様が固まっていないので省略。CRUDがあるとのこと


---

## 認証周り

ログインとか登録のAPIがある。JWT使ってるっぽい。
ヘッダーに Authorization: Bearer xxxx をつける。

### ログイン

POST /api/auth/login

```
{
  email: "...",
  pass: "..."
}
```

レスポンス: 200

アクセストークンが返る（多分refreshTokenも）


---

## TODO
- [ ] エラーレスポンスの形式をまとめる
- [ ] ステータスコード一覧をつくる
- [ ] PATCH /api/orders/:id/status のステータス遷移を書く
- [ ] DELETE /api/products/:id を追記
- [ ] GET /api/products/:id を追記
- [ ] GET /api/orders/:id を追記
- [ ] 登録APIを追記
- [ ] リフレッシュトークンのAPIを追記
- [ ] GET /api/auth/me を追記
- [ ] 注文キャンセルAPIを追記
- [ ] レート制限について書く
- [ ] 環境変数の一覧は別ファイルに切り出す

---

メモ: 在庫管理のロジックが変わったかも。前は在庫チェックなかったけど今はあるっぽい。要確認。
メモ2: カテゴリにslugが追加されたらしい
メモ3: 管理者ロール周りの挙動が不明。商品作成にadmin権限が必要になった？
