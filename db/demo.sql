/* =======================================================
   dshackathon2025 – fresh schema  (2025-07-05)
   -------------------------------------------------------
   users        : 認証テーブル
   fridge       : ユーザーごとの在庫（1 行 = 1 食材）
   ingredients  : ユーザーごとの買い物リスト
                  fridge_id で在庫行と片方向リンク
======================================================= */

/* ---------- 旧テーブルを一旦破棄する場合 ---------- */
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS fridge      CASCADE;
DROP TABLE IF EXISTS users       CASCADE;

/* ---------- 1. users -------------------------------- */
CREATE TABLE users (
    user_id   SERIAL PRIMARY KEY,
    user_name TEXT NOT NULL UNIQUE,
    password  TEXT NOT NULL
);

/* ---------- 2. fridge ------------------------------- */
CREATE TABLE fridge (
    fridge_id     SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL
                   REFERENCES users(user_id)
                   ON DELETE CASCADE,
    fridge_name   TEXT    NOT NULL,
    fridge_amount TEXT,
    --  同ユーザーで同じ食材名は 1 行にする想定なら UNIQUE を推奨
    UNIQUE (user_id, fridge_name)
);

/* ---------- 3. ingredients -------------------------- */
CREATE TABLE ingredients (
    ingredients_id   SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL
                     REFERENCES users(user_id)
                     ON DELETE CASCADE,
    fridge_id        INTEGER
                     REFERENCES fridge(fridge_id)
                     ON DELETE SET NULL,
    ingredients_name TEXT    NOT NULL,
    amount           TEXT,
    bought           BOOLEAN DEFAULT false,
    --  同ユーザーで同じ食材名 1 行に制限したい場合は UNIQUE
    UNIQUE (user_id, ingredients_name)
);