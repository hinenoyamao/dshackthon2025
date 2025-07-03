/* ============================================================
   1. マスターテーブル
   ============================================================ */

/* 1-A) 食材カテゴリ ― 追加も削除もしやすい設計 */
create table categories(
    category_id serial primary key,
    category_name text unique not null          -- 例: 野菜, 肉, 魚 ...
);

/* 1-B) 食材アイテム ― カテゴリを外部キーで参照 */
create table food_items (
    item_id serial primary key,
    item_name text unique not null,         -- 例: にんじん, 鶏むね肉
    category_id integer
              references categories(category_id)
                on delete restrict,         -- カテゴリ削除時を抑止
    created_at timestamptz default now()            
);

/* ============================================================
   2. コアエンティティ
   ============================================================ */

/* 2-A) ユーザー */
create table users (
    user_id serial primary key,
    user_name text not null,
    email text unique,
    created_at timestamptz default now()
);

/* 2-B) 冷蔵庫在庫  (= 1ユーザー × 1食材 × 1賞味期限 で一意) */
CREATE TABLE inventories (
    inventory_id     SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL
                       REFERENCES users(user_id) ON DELETE CASCADE,
    item_id          INTEGER NOT NULL
                       REFERENCES food_items(item_id) ON DELETE RESTRICT,
    quantity         NUMERIC NOT NULL CHECK (quantity >= 0),  -- ← 修正！
    expiration_date  DATE,
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (user_id, item_id, expiration_date)
);