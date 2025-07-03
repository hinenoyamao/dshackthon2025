require("dotenv").config();
const path    = require("path");
const express = require("express");
const { Pool } = require("pg");

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

/* ───────── 仮ユーザー ───────── */
const USER_ID = 1;
/* users(id=1) が無ければ自動で作成 */
pool.query(
  `INSERT INTO users(user_id,user_name,password)
     VALUES ($1,'demo','dummy')
     ON CONFLICT (user_id) DO NOTHING`,
  [USER_ID]
);

/* ╭──────────────╮
   │ 1. 冷蔵庫 API │
   ╰──────────────╯ */
app.get("/api/fridge", async (_q, res) => {
  const { rows } = await pool.query(
    `SELECT fridge_id, fridge_name AS name, fridge_amount AS amount
       FROM fridge WHERE user_id=$1 ORDER BY fridge_id`,
    [USER_ID]
  );
  res.json(rows);
});

app.post("/api/fridge", async (req, res) => {
  const { name = "", amount = "" } = req.body;
  if (!name.trim() || !amount.trim()) {
    return res.status(400).json({ error: "食材名と量を入力してください" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO fridge (user_id, fridge_name, fridge_amount)
         VALUES ($1,$2,$3) RETURNING fridge_id`,
      [USER_ID, name.trim(), amount.trim()]
    );
    res.json({ id: rows[0].fridge_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error" });
  }
});

app.delete("/api/fridge/:id", async (req, res) => {
  await pool.query(
    `DELETE FROM fridge WHERE fridge_id=$1 AND user_id=$2`,
    [req.params.id, USER_ID]
  );
  res.json({ deleted: true });
});

/* ╭─────────────────────────────╮
   │ 2. 買い物リスト＝ingredients │
   ╰─────────────────────────────╯ */
const parseAmount = (s = "") => {
  const m = s.trim().match(/^([0-9]+(?:\.[0-9]+)?)(.*)$/);
  return m ? { num: parseFloat(m[1]), unit: m[2] } : { num: null, unit: s.trim() };
};

/* 2-1 取得 */
app.get("/api/ingredients", async (_q, res) => {
  const { rows } = await pool.query(
    `SELECT ingredients_id AS id,
            ingredients_name AS name,
            amount, bought
       FROM ingredients
      WHERE user_id=$1
      ORDER BY ingredients_id`,
    [USER_ID]
  );
  res.json(rows);
});

/* 2-2 追加（重複は量を合算） */
app.post("/api/ingredients/add", async (req, res) => {
  const items = req.body.items || [];

  for (const it of items) {
    const { rows } = await pool.query(
      `SELECT ingredients_id, amount
         FROM ingredients
        WHERE user_id=$1 AND ingredients_name=$2`,
      [USER_ID, it.name]
    );

    if (rows.length) {
      const cur = parseAmount(rows[0].amount);
      const add = parseAmount(it.amount);
      const merged =
        cur.num !== null && add.num !== null && cur.unit === add.unit
          ? `${cur.num + add.num}${cur.unit}`
          : `${rows[0].amount} + ${it.amount}`;

      await pool.query(
        `UPDATE ingredients SET amount=$1 WHERE ingredients_id=$2`,
        [merged, rows[0].ingredients_id]
      );
    } else {
      await pool.query(
        `INSERT INTO ingredients
           (user_id, fridge_id, ingredients_name, amount, bought)
         VALUES ($1, NULL, $2, $3, FALSE)`,
        [USER_ID, it.name, it.amount]
      );
    }
  }

  const all = await pool.query(
    `SELECT ingredients_id AS id, ingredients_name AS name, amount, bought
       FROM ingredients WHERE user_id=$1 ORDER BY ingredients_id`,
    [USER_ID]
  );
  res.json(all.rows);
});

/* 2-3 チェックボックス状態変更 */
app.patch("/api/ingredients/check", async (req, res) => {
  const { id, checked } = req.body;
  await pool.query(
    `UPDATE ingredients SET bought=$1
       WHERE ingredients_id=$2 AND user_id=$3`,
    [checked, id, USER_ID]
  );
  res.json({ ok: true });
});

/* 2-4 購入済み削除 */
app.delete("/api/ingredients/clearBought", async (_q, res) => {
  await pool.query(
    `DELETE FROM ingredients WHERE bought=true AND user_id=$1`,
    [USER_ID]
  );
  res.json({ cleared: true });
});

/* ╭──────────────╮
   │ 3. ダミー LLM │
   ╰──────────────╯ */
app.post("/parseRecipe", (req, res) => {
  const recipe = (req.body.recipe || "").trim();
  if (!recipe) return res.status(400).json({ error: "recipe empty" });

  res.json([
    { name: "じゃがいも", amount: "2個" },
    { name: "にんじん",   amount: "1本" },
    { name: "玉ねぎ",     amount: "1個" }
  ]);
});

/* ───────── 起動 ───────── */
app.listen(PORT, () =>
  console.log(`✓ Express on http://localhost:${PORT}`)
);