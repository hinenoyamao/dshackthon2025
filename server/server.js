/* ==========================================================
   Recipe Helper – Backend  (2025-07-05  half-width fix)
   ・全角数字／全角ドットを自動で半角へ変換してから計算
   ・fridge 重複時マージ、購入済み→在庫移動 すべてで有効
========================================================== */

require("dotenv").config();
const express       = require("express");
const path          = require("path");
const { Pool }      = require("pg");
const bcrypt        = require("bcrypt");
const jwt           = require("jsonwebtoken");
const cookieParser  = require("cookie-parser");

/* Node18 未満用 fetch polyfill */
const fetch =
  (typeof global.fetch === "function")
    ? global.fetch
    : (...a) => import("node-fetch").then(m => m.default(...a));

const JWT_SECRET    = process.env.JWT_SECRET  || "dev-secret";
const USE_DUMMY_LLM = process.env.USE_DUMMY_LLM === "true";

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(cookieParser());

/* ╭──────────────────────────╮
   │ 共通ヘルパー              │
   ╰──────────────────────────╯ */

/* 全角 → 半角（数字とドット） */
const toHalf = s =>
  s.replace(/[０-９．]/g, ch =>
    ch === "．" ? "." : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

/* 量文字列を数値+単位へパース（半角化してから） */
const parseAmount = (str = "") => {
  const half = toHalf(str);
  const m = half.trim().match(/^([0-9]+(?:\.[0-9]+)?)(.*)$/);
  return m ? { num: +m[1], unit: m[2] } : { num: null, unit: half.trim() };
};

/* 認証ミドルウェア */
function auth(req, res, next) {
  const tok = req.cookies.token;
  if (!tok) return res.status(401).json({ error: "unauth" });
  try { req.user = jwt.verify(tok, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "bad token" }); }
}

/* ╭──────────────────────────╮
   │ /auth API  (同一内容)      │
   ╰──────────────────────────╯ */
app.post("/auth/signup", async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password)
    return res.status(400).json({ error: "name/pass required" });
  const dup = await pool.query(
    `SELECT 1 FROM users WHERE user_name=$1`, [name]);
  if (dup.rowCount) return res.status(409).json({ error: "duplicate" });
  await pool.query(
    `INSERT INTO users(user_name,password) VALUES($1,$2)`,
    [name, await bcrypt.hash(password, 10)]);
  res.json({ ok: true });
});

app.post("/auth/login", async (req, res) => {
  const { name, password } = req.body;
  const r = await pool.query(
    `SELECT user_id,password FROM users WHERE user_name=$1`, [name]);
  if (!r.rowCount) return res.status(400).json({ error: "not found" });
  if (!await bcrypt.compare(password, r.rows[0].password))
    return res.status(400).json({ error: "wrong pass" });
  const token = jwt.sign(
    { id: r.rows[0].user_id, name },
    JWT_SECRET,
    { expiresIn: "7d" });
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1e3 });
  res.json({ ok: true, name });
});

app.get("/auth/me", (req, res) => {
  try {
    const tok = req.cookies.token;
    if (!tok) return res.json({ user: null });
    const u = jwt.verify(tok, JWT_SECRET);
    res.json({ user: { id: u.id, name: u.name } });
  } catch { res.json({ user: null }); }
});

app.post("/auth/logout", (_q, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

/* ╭──────────────────────────╮
   │ fridge API（重複マージ）   │
   ╰──────────────────────────╯ */
app.get("/api/fridge", auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT fridge_id, fridge_name AS name, fridge_amount AS amount
       FROM fridge WHERE user_id=$1 ORDER BY fridge_id`, [req.user.id]);
  res.json(rows);
});

app.post("/api/fridge", auth, async (req, res) => {
  const { name, amount } = req.body;

  /* 同名行があればマージ */
  const ex = await pool.query(
    `SELECT fridge_id, fridge_amount FROM fridge
       WHERE user_id=$1 AND fridge_name=$2`,
    [req.user.id, name]);
  if (ex.rowCount) {
    const cur = parseAmount(ex.rows[0].fridge_amount);
    const add = parseAmount(amount);
    const merged = (cur.num !== null && add.num !== null && cur.unit === add.unit)
      ? `${cur.num + add.num}${cur.unit}`
      : `${ex.rows[0].fridge_amount} + ${amount}`;
    await pool.query(
      `UPDATE fridge SET fridge_amount=$1 WHERE fridge_id=$2`,
      [merged, ex.rows[0].fridge_id]);
    return res.json({ id: ex.rows[0].fridge_id, merged: true });
  }

  /* 新規行 */
  const fr = await pool.query(
    `INSERT INTO fridge(user_id, fridge_name, fridge_amount)
       VALUES($1,$2,$3) RETURNING fridge_id`,
    [req.user.id, name, amount]);
  const fid = fr.rows[0].fridge_id;

  /* 対応する ingredients の fridge_id を埋める */
  await pool.query(
    `UPDATE ingredients SET fridge_id=$1
       WHERE user_id=$2 AND ingredients_name=$3 AND fridge_id IS NULL`,
    [fid, req.user.id, name]);

  res.json({ id: fid, merged: false });
});

app.delete("/api/fridge/:id", auth, async (req, res) => {
  await pool.query(
    `DELETE FROM fridge WHERE fridge_id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]);
  await pool.query(
    `UPDATE ingredients SET fridge_id=NULL
       WHERE fridge_id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]);
  res.json({ deleted: true });
});

/* ╭──────────────────────────╮
   │ ingredients API           │
   ╰──────────────────────────╯ */
app.get("/api/ingredients", auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ingredients_id AS id, ingredients_name AS name, amount, bought
       FROM ingredients WHERE user_id=$1 ORDER BY ingredients_id`,
    [req.user.id]);
  res.json(rows);
});

app.post("/api/ingredients/add", auth, async (req, res) => {
  const items = req.body.items || [];

  for (const it of items) {
    /* 在庫行をチェック */
    const fr = await pool.query(
      `SELECT fridge_id, fridge_amount FROM fridge
         WHERE user_id=$1 AND fridge_name=$2`,
      [req.user.id, it.name]);
    const fid = fr.rows[0]?.fridge_id || null;

    /* 同名 ingredients 行 */
    const ex = await pool.query(
      `SELECT ingredients_id, amount FROM ingredients
         WHERE user_id=$1 AND ingredients_name=$2`,
      [req.user.id, it.name]);

    if (ex.rowCount) {
      const cur = parseAmount(ex.rows[0].amount);
      const add = parseAmount(it.amount);
      const merged = (cur.num !== null && add.num !== null && cur.unit === add.unit)
        ? `${cur.num + add.num}${cur.unit}`
        : `${ex.rows[0].amount} + ${it.amount}`;
      await pool.query(
        `UPDATE ingredients
            SET amount=$1,
                fridge_id = COALESCE(fridge_id,$2)
          WHERE ingredients_id=$3`,
        [merged, fid, ex.rows[0].ingredients_id]);
    } else {
      await pool.query(
        `INSERT INTO ingredients
              (user_id, fridge_id, ingredients_name, amount, bought)
         VALUES ($1,$2,$3,$4,false)`,
        [req.user.id, fid, it.name, it.amount]);
    }
  }

  const all = await pool.query(
    `SELECT ingredients_id AS id, ingredients_name AS name, amount, bought
       FROM ingredients WHERE user_id=$1 ORDER BY ingredients_id`,
    [req.user.id]);
  res.json(all.rows);
});

app.patch("/api/ingredients/check", auth, async (req, res) => {
  const { id, checked } = req.body;
  await pool.query(
    `UPDATE ingredients SET bought=$1
       WHERE ingredients_id=$2 AND user_id=$3`,
    [checked, id, req.user.id]);
  res.json({ ok: true });
});

app.delete("/api/ingredients/clearBought", auth, async (req, res) => {
  /* ① 購入済みを取得 */
  const bought = await pool.query(
    `SELECT ingredients_name AS name, amount
       FROM ingredients
      WHERE bought=true AND user_id=$1`,
    [req.user.id]);

  /* ② 在庫へマージ / 新規追加 */
  for (const row of bought.rows) {
    const fr = await pool.query(
      `SELECT fridge_id, fridge_amount FROM fridge
         WHERE user_id=$1 AND fridge_name=$2`,
      [req.user.id, row.name]);
    if (fr.rowCount) {
      const cur = parseAmount(fr.rows[0].fridge_amount);
      const add = parseAmount(row.amount);
      const merged =
        cur.num !== null && add.num !== null && cur.unit === add.unit
          ? `${cur.num + add.num}${cur.unit}`
          : `${fr.rows[0].fridge_amount} + ${row.amount}`;
      await pool.query(
        `UPDATE fridge SET fridge_amount=$1 WHERE fridge_id=$2`,
        [merged, fr.rows[0].fridge_id]);
    } else {
      await pool.query(
        `INSERT INTO fridge
              (user_id, fridge_name, fridge_amount)
         VALUES ($1,$2,$3)`,
        [req.user.id, row.name, row.amount]);
    }
  }

  /* ③ 削除 */
  await pool.query(
    `DELETE FROM ingredients WHERE bought=true AND user_id=$1`,
    [req.user.id]);

  res.json({ moved: bought.rowCount });
});

/* ╭──────────────────────────╮
   │ parseRecipe – LLM fallback │
   ╰──────────────────────────╯ */
app.post("/parseRecipe", async (req, res) => {
  const recipe = (req.body.recipe || "").trim();
  if (!recipe) return res.status(400).json({ error: "recipe text empty" });

  if (USE_DUMMY_LLM) return res.json(DUMMY());

  try {
    const prompt = `料理名から必要な材料を推測して…\n料理名: ${recipe}`;
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000/",
        "X-Title": "RecipeHelper"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout:free",
        messages: [{ role: "user", content: prompt }]
      }),
      timeout: 30_000
    });
    if (!r.ok) throw new Error(`upstream ${r.status}`);

    const raw = (await r.json()).choices[0].message.content;
    const out = [], pat = /^\s*([^\s\u3000:：]+.*?)\s*[:：]\s*(.+)$/;
    raw.split(/\r?\n/).forEach(line => {
      const m = line.trim().match(pat);
      if (m) out.push({ name: m[1].trim(), amount: m[2].trim() });
    });
    if (out.length) return res.json(out);
    throw new Error("parse failed");
  } catch (e) {
    console.warn("LLM error → fallback dummy:", e.message);
    res.json(DUMMY());
  }
});

/* ダミー材料 */
const DUMMY = () => ([
  { name: "じゃがいも", amount: "2個" },
  { name: "にんじん",   amount: "1本" },
  { name: "玉ねぎ",     amount: "1個" }
]);

/* 起動 */
app.listen(PORT, () =>
  console.log(`✓ http://localhost:${PORT}  |  LLM=${USE_DUMMY_LLM ? "dummy-only" : "live+fallback"}`));