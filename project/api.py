from flask import Flask, request, jsonify
import requests, os, re
from dotenv import load_dotenv

# ─── OpenRouter API セットアップ ─────────────────
load_dotenv()  # .env から読み込み
API_KEY = os.getenv("API_KEY")  # 必ず .env に設定
API_URL = "https://openrouter.ai/api/v1/chat/completions"

HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

MODEL = "meta-llama/llama-4-scout:free"

# ─── Flask アプリ ────────────────────────────────
app = Flask(__name__, static_folder="frontend", static_url_path="/")


@app.route("/")
def index():
    # front 配下の index.html を返す (静的ファイル)
    return app.send_static_file("index.html")


@app.route("/parseRecipe", methods=["POST"])
def parse_recipe():
    """フロントから {recipe:"カレー"} を受け取り → LLM に投げて材料JSONを返す"""
    data = request.get_json(force=True)
    recipe = (data or {}).get("recipe", "").strip()

    if not recipe:
        return jsonify({"error": "recipe text empty"}), 400

    # ── プロンプト：元の文章を利用し、料理名だけ差し込み ──
    prompt = f"""
料理名から必要な材料を推測して教えて欲しい。
例：料理　カレー
　　人数　2人
　　材料　にんじん1本

{recipe}に必要な材料は何
""".strip()

    payload = {"model": MODEL, "messages": [{"role": "user", "content": prompt}]}

    try:
        r = requests.post(API_URL, headers=HEADERS, json=payload, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        return jsonify({"error": f"LLM API error: {e}"}), 502

    raw_reply = r.json()["choices"][0]["message"]["content"]

    # ── 超簡易パース: 「材料 量」っぽい行を抽出 → [{name,amount}] ──
    ingredients = []
    for line in raw_reply.splitlines():
        line = line.strip(" ・-—[]・:：")  # 先頭の記号を除去
        if not line:
            continue
        # 区切りをコロン / スペース / タブで探す
        m = re.split(r"[：:\t ]{1,}", line, maxsplit=1)
        if len(m) == 2 and m[0] and m[1]:
            ingredients.append({"name": m[0], "amount": m[1]})

    # 1件もパースできなかったら raw も渡す
    if not ingredients:
        return jsonify({"raw": raw_reply}), 200

    return jsonify(ingredients), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
