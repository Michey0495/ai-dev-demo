# ER図（Mermaid）

```mermaid
---
title: ECサイト データベース（第3正規形）
---
erDiagram
    categories {
        serial   id          PK "カテゴリID"
        varchar  name        UK "カテゴリ名（一意）"
        integer  sort_order     "表示順"
        timestamptz created_at "作成日時"
        timestamptz updated_at "更新日時"
    }

    users {
        serial   id             PK "ユーザーID"
        varchar  email          UK "メールアドレス（一意）"
        varchar  password_hash     "パスワードハッシュ"
        varchar  last_name         "姓"
        varchar  first_name        "名"
        varchar  phone             "電話番号"
        varchar  zip_code          "郵便番号"
        varchar  prefecture        "都道府県"
        varchar  city              "市区町村"
        varchar  address_line      "番地以降"
        varchar  status            "active / suspended / withdrawn"
        timestamptz created_at     "登録日時"
        timestamptz updated_at     "最終更新日時"
    }

    products {
        serial   id             PK "商品ID"
        varchar  sku            UK "SKUコード（一意）"
        varchar  name              "商品名"
        text     description       "商品説明"
        integer  price             "税抜価格（0以上）"
        integer  stock             "在庫数（0以上）"
        integer  category_id    FK "カテゴリID"
        varchar  status            "active / hidden / discontinued"
        timestamptz created_at     "登録日時"
        timestamptz updated_at     "最終更新日時"
    }

    orders {
        serial   id                    PK "注文ID"
        integer  user_id               FK "注文者ID"
        varchar  order_number          UK "注文番号（一意）"
        integer  total_amount             "合計金額（税込）"
        varchar  status                   "unpaid / paid / preparing / shipped / cancelled"
        varchar  shipping_zip_code        "配送先 郵便番号"
        varchar  shipping_prefecture      "配送先 都道府県"
        varchar  shipping_city            "配送先 市区町村"
        varchar  shipping_address_line    "配送先 番地以降"
        timestamptz ordered_at            "注文日時"
        timestamptz created_at            "作成日時"
        timestamptz updated_at            "更新日時"
    }

    order_items {
        serial   id          PK "明細ID"
        integer  order_id    FK "注文ID"
        integer  product_id  FK "商品ID"
        integer  quantity       "注文数量（1以上）"
        integer  unit_price    "注文時単価（0以上）"
        timestamptz created_at "作成日時"
        timestamptz updated_at "更新日時"
    }

    categories ||--o{ products      : "1カテゴリ → 複数商品"
    users      ||--o{ orders        : "1ユーザー → 複数注文"
    orders     ||--|{ order_items   : "1注文 → 1件以上の明細"
    products   ||--o{ order_items   : "1商品 → 複数明細"
```

## リレーション一覧

| 親テーブル | 子テーブル | カーディナリティ | 説明 |
|-----------|-----------|----------------|------|
| categories | products | 1 対 多 | 商品は必ず1カテゴリに所属する |
| users | orders | 1 対 多 | 注文は必ず1人の会員に紐づく |
| orders | order_items | 1 対 多（1以上） | 注文には最低1件の明細が必要 |
| products | order_items | 1 対 多 | 明細は必ず1商品を参照する |

## before との差分

| 観点 | before | after |
|------|--------|-------|
| カテゴリ | products.categoryName に直接格納 | categories テーブルに分離、FK で参照 |
| 命名規則 | camelCase と snake_case が混在 | snake_case に統一 |
| 外部キー | 制約なし | 全FK に REFERENCES 定義 |
| インデックス | なし | 検索頻度の高い9カラムに作成 |
| CHECK制約 | なし | status, price, stock, quantity に設定 |
| UNIQUE制約 | なし | email, sku, order_number, (order_id + product_id) |
| VARCHAR桁数 | 無指定 | 全カラムに桁数指定 |
| タイムスタンプ | TIMESTAMP, DEFAULT なし | TIMESTAMPTZ, DEFAULT NOW(), トリガー自動更新 |
| パスワード | password（平文想起） | password_hash（ハッシュ前提） |
