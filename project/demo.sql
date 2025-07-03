/* ── 1. users テーブル ───────────────────────────── */
CREATE TABLE users (
    user_id    SERIAL PRIMARY KEY,
    user_name  TEXT   NOT NULL,
    password   TEXT   NOT NULL
);

/* ── 2. fridge テーブル（ingredients への FK は後で付与） ─ */
CREATE TABLE fridge (
    fridge_id      SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL
                     REFERENCES users(user_id)
                     ON DELETE CASCADE,
    ingredients_id INTEGER,          -- FK は後で付与
    fridge_name    TEXT,
    fridge_amount  NUMERIC
);

/* ── 3. ingredients テーブル ─────────────────────── */
CREATE TABLE ingredients (
    ingredients_id     SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL
                         REFERENCES users(user_id)
                         ON DELETE CASCADE,
    fridge_id          INTEGER NOT NULL
                         REFERENCES fridge(fridge_id)
                         ON DELETE CASCADE,
    ingredients_name   TEXT    NOT NULL
);

/* ── 4. 相互参照となる FK を後付け ───────────────── */
ALTER TABLE fridge
  ADD CONSTRAINT fk_fridge_ingredients
  FOREIGN KEY (ingredients_id)
  REFERENCES ingredients(ingredients_id)
  ON DELETE CASCADE;