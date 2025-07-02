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
    item_name text unique not null,　　　　　　　　-- 例: にんじん, 鶏むね肉
    category_id integer
              references categories(category_id)
                on delete set null,　　　　　　　  -- カテゴリ削除時を抑止
    created_at timestamptz default now()            
);