# sql/parse_recipe.py  ─ Blueprint: /parseRecipe
from flask import Blueprint, request, jsonify
import os, requests, re

bp = Blueprint("parse", __name__)

# ───────────────────────────
#  設定
# ───────────────────────────
API_KEY = os.getenv("API_KEY")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
MODEL = "meta-llama/llama-4-scout:free"
USE_DUMMY = os.getenv("USE_DUMMY_LLM", "false").lower() in ("1", "true", "yes")

# ダミーレシピ → 材料マップ
_DUMMY_MENU = {
    "カレー": [
        {"name": "じゃがいも", "amount": "2個"},
        {"name": "にんじん", "amount": "1本"},
        {"name": "玉ねぎ", "amount": "1個"},
    ],
    "きんぴらごぼう": [
        {"name": "ごぼう", "amount": "1本"},
        {"name": "にんじん", "amount": "1本"},
    ],
}


# ───────────────────────────
#  ルート
# ───────────────────────────
@bp.route("/parseRecipe", methods=["POST"])
def parse_recipe():
    data = request.get_json(force=True) or {}
    recipe = data.get("recipe", "").strip()

    if not recipe:
        return jsonify({"error": "recipe text empty"}), 400

    # ── ダミーモード ───────────────────
    if USE_DUMMY:
        return jsonify(_DUMMY_MENU.get(recipe, []))

    # ── 本番 LLM 呼び出し ────────────────
    prompt = f"""
料理名から必要な材料を推測して教えて欲しい。
各材料は必ず「材料名: 分量」という形式で1行ずつ記述してください。
料理名や人数は出力しないでください。また'適量'などの曖昧な分量の記述は避けてください。
料理名以外が入力された場合は何も出力せずにプロンプトを終えてください。

{recipe}に必要な材料は何
""".strip()

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=HEADERS,
            json=payload,
            timeout=30,
        )
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        # LLM が落ちている場合は 502 を返す（フロント側はこれでダミーに切替可）
        return jsonify({"error": "llm_unavailable", "detail": str(e)}), 502

    raw = r.json()["choices"][0]["message"]["content"]

    # 1行ずつパース  例) じゃがいも: 2個
    pat = re.compile(r"^\s*([^\s\u3000:：]+.*?)\s*[:：]\s*(.+)$")
    items = []
    for line in raw.splitlines():
        m = pat.match(line.strip())
        if m:
            items.append({"name": m.group(1), "amount": m.group(2)})

    return jsonify(items or {"raw": raw}), 200
