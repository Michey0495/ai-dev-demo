-- ECサイト データベーススキーマ（初版）
-- 作成者: 新人開発者A
-- ※ このスキーマには意図的にアンチパターンを含む（研修デモ用）

-- ============================================
-- [アンチパターン1] 正規化不足
--   categoryName を products に直接持たせている。
--   カテゴリ名の変更時に全商品レコードを UPDATE する必要があり、
--   更新異常と不整合の温床になる。
-- ============================================

-- ============================================
-- [アンチパターン2] 命名規則の混在
--   users: snake_case (created_at)
--   products: camelCase (createdAt, categoryName)
--   orders: snake_case (order_number) + camelCase なし
--   order_items: camelCase (orderId, productId)
--   → チーム開発で混乱を招く
-- ============================================

-- ============================================
-- [アンチパターン3] 外部キー制約の欠落
--   orders.userId → users.id の参照整合性がない
--   order_items.orderId → orders.id も同様
--   order_items.productId → products.id も同様
--   → 存在しないユーザーや商品への紐づけが可能
-- ============================================

-- ============================================
-- [アンチパターン4] インデックスゼロ
--   WHERE user_id = ? や WHERE status = ? のような
--   頻出クエリでフルテーブルスキャンが走る
-- ============================================

-- ============================================
-- [アンチパターン5] VARCHAR 桁数なし / 制約不足
--   VARCHAR に桁数を指定していないため、
--   255文字のメールも10万文字のメールも入る。
--   NOT NULL, CHECK, UNIQUE がほぼ皆無。
--   password を平文格納する前提のカラム名になっている。
-- ============================================


CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR,                          -- UNIQUE なし → 同一メールで重複登録可能
  password VARCHAR,                       -- "password" という名前 → 平文保存を想起させる
  firstName VARCHAR,                      -- camelCase（他テーブルと不統一）
  lastName VARCHAR,
  phone VARCHAR,
  zipcode VARCHAR,                        -- "zip_code" でも "zipcode" でもなく揺れ
  prefecture VARCHAR,
  city VARCHAR,
  address VARCHAR,
  status VARCHAR DEFAULT 'active',        -- CHECK 制約なし → 任意の文字列が入る
  created_at TIMESTAMP                    -- DEFAULT なし / TIMESTAMPTZ でない / updated_at なし
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR,
  description TEXT,
  price INTEGER,                          -- CHECK (price >= 0) なし → マイナス価格が可能
  stock INTEGER,                          -- 同上、マイナス在庫が可能
  sku VARCHAR,                            -- UNIQUE なし → SKU の一意性が保証されない
  categoryName VARCHAR,                   -- [正規化不足] カテゴリをテーブル分離すべき
  status VARCHAR DEFAULT 'active',
  createdAt TIMESTAMP,                    -- camelCase（snake_case と混在）
  updatedAt TIMESTAMP
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  userId INTEGER,                         -- FK 制約なし → 存在しないユーザーを指定可能
  order_number VARCHAR,                   -- UNIQUE なし → 注文番号の一意性なし
  total_amount INTEGER,
  status VARCHAR DEFAULT 'pending',       -- 要件では 'unpaid' なのに 'pending' になっている
  shipping_zipcode VARCHAR,
  shipping_prefecture VARCHAR,
  shipping_city VARCHAR,
  shipping_address VARCHAR,
  ordered_at TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  orderId INTEGER,                        -- camelCase + FK 制約なし
  productId INTEGER,                      -- 同上
  quantity INTEGER,                       -- CHECK (quantity > 0) なし → 0個注文が可能
  unit_price INTEGER                      -- created_at / updated_at すら存在しない
);
