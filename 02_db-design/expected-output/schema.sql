-- =============================================================
-- ECサイト データベーススキーマ（PostgreSQL 15+）
-- 第3正規形準拠 / snake_case 統一 / 制約・インデックス完備
-- =============================================================

-- updated_at 自動更新トリガー関数
-- 全テーブル共通で使用する
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================
-- カテゴリ
-- before では products.categoryName に直接格納していた。
-- テーブル分離で更新異常を排除し、カテゴリの追加・変更を1行で完結させる。
-- =============================================================
CREATE TABLE categories (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  categories              IS '商品カテゴリ';
COMMENT ON COLUMN categories.id           IS 'カテゴリID（自動採番）';
COMMENT ON COLUMN categories.name         IS 'カテゴリ名（一意制約）';
COMMENT ON COLUMN categories.sort_order   IS '表示順（昇順ソート用）';
COMMENT ON COLUMN categories.created_at   IS '作成日時';
COMMENT ON COLUMN categories.updated_at   IS '更新日時（トリガーで自動更新）';

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================
-- ユーザー（会員）
-- before から改善: email UNIQUE, password_hash に名称変更,
-- 全カラム snake_case, CHECK 制約でステータスを列挙
-- =============================================================
CREATE TABLE users (
  id                SERIAL        PRIMARY KEY,
  email             VARCHAR(255)  NOT NULL UNIQUE,
  password_hash     VARCHAR(255)  NOT NULL,
  last_name         VARCHAR(50)   NOT NULL,
  first_name        VARCHAR(50)   NOT NULL,
  phone             VARCHAR(20),
  zip_code          VARCHAR(8)    NOT NULL,
  prefecture        VARCHAR(10)   NOT NULL,
  city              VARCHAR(50)   NOT NULL,
  address_line      VARCHAR(200)  NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'withdrawn')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users                IS '会員';
COMMENT ON COLUMN users.id             IS 'ユーザーID（自動採番）';
COMMENT ON COLUMN users.email          IS 'メールアドレス（ログインID、一意）';
COMMENT ON COLUMN users.password_hash  IS 'パスワードハッシュ（平文保存禁止）';
COMMENT ON COLUMN users.last_name      IS '姓';
COMMENT ON COLUMN users.first_name     IS '名';
COMMENT ON COLUMN users.phone          IS '電話番号（任意）';
COMMENT ON COLUMN users.zip_code       IS '郵便番号（ハイフンなし7桁 or ハイフンあり8桁）';
COMMENT ON COLUMN users.prefecture     IS '都道府県';
COMMENT ON COLUMN users.city           IS '市区町村';
COMMENT ON COLUMN users.address_line   IS '番地以降';
COMMENT ON COLUMN users.status         IS '会員ステータス: active=有効 / suspended=停止 / withdrawn=退会済み';
COMMENT ON COLUMN users.created_at     IS '登録日時';
COMMENT ON COLUMN users.updated_at     IS '最終更新日時';

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_status ON users (status);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================
-- 商品
-- before から改善: categoryName → category_id (FK),
-- SKU に UNIQUE, price/stock に CHECK >= 0, VARCHAR 桁数指定
-- =============================================================
CREATE TABLE products (
  id            SERIAL        PRIMARY KEY,
  sku           VARCHAR(50)   NOT NULL UNIQUE,
  name          VARCHAR(200)  NOT NULL,
  description   TEXT,
  price         INTEGER       NOT NULL CHECK (price >= 0),
  stock         INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id   INTEGER       NOT NULL REFERENCES categories(id),
  status        VARCHAR(20)   NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'hidden', 'discontinued')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  products               IS '商品';
COMMENT ON COLUMN products.id            IS '商品ID（自動採番）';
COMMENT ON COLUMN products.sku           IS 'SKUコード（在庫管理用、一意）';
COMMENT ON COLUMN products.name          IS '商品名';
COMMENT ON COLUMN products.description   IS '商品説明（長文のため TEXT 型）';
COMMENT ON COLUMN products.price         IS '税抜価格（円、0以上の整数）';
COMMENT ON COLUMN products.stock         IS '在庫数（0以上の整数）';
COMMENT ON COLUMN products.category_id   IS 'カテゴリID（categories.id への外部キー）';
COMMENT ON COLUMN products.status        IS '販売ステータス: active=公開中 / hidden=非公開 / discontinued=販売終了';
COMMENT ON COLUMN products.created_at    IS '登録日時';
COMMENT ON COLUMN products.updated_at    IS '最終更新日時';

CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_status      ON products (status);
CREATE INDEX idx_products_sku         ON products (sku);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================
-- 注文
-- before から改善: userId → user_id (FK), order_number UNIQUE,
-- status の CHECK に要件通りの5値を列挙,
-- 配送先住所はスナップショットとして注文側に保持
-- =============================================================
CREATE TABLE orders (
  id                    SERIAL        PRIMARY KEY,
  user_id               INTEGER       NOT NULL REFERENCES users(id),
  order_number          VARCHAR(30)   NOT NULL UNIQUE,
  total_amount          INTEGER       NOT NULL CHECK (total_amount >= 0),
  status                VARCHAR(20)   NOT NULL DEFAULT 'unpaid'
                        CHECK (status IN (
                          'unpaid',      -- 未決済
                          'paid',        -- 決済済み
                          'preparing',   -- 発送準備中
                          'shipped',     -- 発送済み
                          'cancelled'    -- キャンセル
                        )),
  shipping_zip_code     VARCHAR(8)    NOT NULL,
  shipping_prefecture   VARCHAR(10)   NOT NULL,
  shipping_city         VARCHAR(50)   NOT NULL,
  shipping_address_line VARCHAR(200)  NOT NULL,
  ordered_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  orders                        IS '注文';
COMMENT ON COLUMN orders.id                     IS '注文ID（自動採番）';
COMMENT ON COLUMN orders.user_id                IS '注文者（users.id への外部キー）';
COMMENT ON COLUMN orders.order_number           IS '注文番号（例: ORD-20260324-0001、一意）';
COMMENT ON COLUMN orders.total_amount           IS '合計金額（税込、円、0以上）';
COMMENT ON COLUMN orders.status                 IS '注文ステータス: unpaid/paid/preparing/shipped/cancelled';
COMMENT ON COLUMN orders.shipping_zip_code      IS '配送先 郵便番号（注文時点のスナップショット）';
COMMENT ON COLUMN orders.shipping_prefecture    IS '配送先 都道府県';
COMMENT ON COLUMN orders.shipping_city          IS '配送先 市区町村';
COMMENT ON COLUMN orders.shipping_address_line  IS '配送先 番地以降';
COMMENT ON COLUMN orders.ordered_at             IS '注文日時';
COMMENT ON COLUMN orders.created_at             IS '作成日時';
COMMENT ON COLUMN orders.updated_at             IS '更新日時';

CREATE INDEX idx_orders_user_id      ON orders (user_id);
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_status       ON orders (status);
CREATE INDEX idx_orders_ordered_at   ON orders (ordered_at DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================
-- 注文明細
-- before から改善: orderId/productId → order_id/product_id (FK),
-- quantity > 0, unit_price >= 0 の CHECK 制約,
-- 同一注文内の商品重複を UNIQUE(order_id, product_id) で防止
-- =============================================================
CREATE TABLE order_items (
  id          SERIAL      PRIMARY KEY,
  order_id    INTEGER     NOT NULL REFERENCES orders(id),
  product_id  INTEGER     NOT NULL REFERENCES products(id),
  quantity    INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price  INTEGER     NOT NULL CHECK (unit_price >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, product_id)
);

COMMENT ON TABLE  order_items              IS '注文明細';
COMMENT ON COLUMN order_items.id           IS '明細ID（自動採番）';
COMMENT ON COLUMN order_items.order_id     IS '注文ID（orders.id への外部キー）';
COMMENT ON COLUMN order_items.product_id   IS '商品ID（products.id への外部キー）';
COMMENT ON COLUMN order_items.quantity     IS '注文数量（1以上）';
COMMENT ON COLUMN order_items.unit_price   IS '注文時点の単価（円、0以上。商品マスタの変更に影響されない）';
COMMENT ON COLUMN order_items.created_at   IS '作成日時';
COMMENT ON COLUMN order_items.updated_at   IS '更新日時';

CREATE INDEX idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
