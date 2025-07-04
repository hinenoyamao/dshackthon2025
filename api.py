from flask import Flask, request, jsonify
import requests, os, re
from dotenv import load_dotenv
from sql import auth, fridge, ingredients, parse_recipe
import logging
from openai import OpenAI
from openai._base_client import SyncHttpxClientWrapper


# os.environ.pop("http_proxy", None)
# os.environ.pop("https_proxy", None)
# os.environ.pop("HTTP_PROXY", None)
# os.environ.pop("HTTPS_PROXY", None)

# API_KEY = os.getenv("API_KEY")
# MODEL = "meta-llama/llama-4-maverick:free"  # 安定性高めのモデルに変更

# # 追加
# API_URL = "https://openrouter.ai/api/v1/chat/completions"
# HEADERS = {
#     "Authorization": f"Bearer {API_KEY}",
#     "Content-Type": "application/json",
# }

# logging.basicConfig(level=logging.DEBUG)

# # APIのセットアップしてる(apikeyはenvファイルで管理してるのでenvファイル持ってなきゃそもそも使えない)
# # load_dotenv()
# # API_KEY = os.getenv("API_KEY")
# # API_URL = "https://openrouter.ai/api/v1/chat/completions"
# # HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
# # MODEL = "meta-llama/llama-4-scout:free"

# # Flask準備
# app = Flask(__name__, static_folder="public", static_url_path="")


# @app.route("/")
# def index():
#     return app.send_static_file("index.html")

# app.register_blueprint(auth.bp)
# app.register_blueprint(fridge.bp)
# app.register_blueprint(ingredients.bp)
# app.register_blueprint(parse_recipe.bp)

# # jsから受け取って料理の名前とか変数化
# @app.route("/parseRecipe", methods=["POST"])
# def handle_parse_recipe():
#     data = request.get_json(force=True)
#     recipe = (data or {}).get("recipe", "").strip()
#     #recipeが空なら400返す
#     if not recipe:
#         return jsonify({"error": "recipe text empty"}), 400

#     # プロンプト定義
#     prompt = f"""
# 料理名から必要な材料を推測して教えて欲しい。
# 各材料は必ず「材料名: 分量」という形式で1行ずつ記述してください。
# 料理名や人数は出力しないでください。また'適量'などの曖昧な分量の記述は避けてください。
# 料理名以外が入力された場合は何も出力せずにプロンプトを終えてください。

# {recipe}に必要な材料は何
# """.strip()

#     # これでAPIにプロンプト投げる準備
#     # payload = {"model": MODEL, "messages": [{"role": "user", "content": prompt}]}
#     payload = {
#     "model": MODEL,
#     "messages": [{"role": "user", "content": prompt}]
#     }
#     try:
#         response = requests.post(API_URL, headers=HEADERS, json=payload, timeout=30)
#         response.raise_for_status()
#         raw_reply = response.json()["choices"][0]["message"]["content"]
#     except Exception as e:
#         return jsonify({"error": f"LLM API error: {str(e)}"}), 502
#     # #　APIに投げるtryが200以外ならexceptに入る
#     # try:
#     #     r = requests.post(API_URL, headers=HEADERS, json=payload, timeout=30)
#     #     r.raise_for_status()
#     # except requests.RequestException as e:
#     #     return jsonify({"error": f"LLM API error: {e}"}), 502

#     # # 出力結果のテキストだけを変数に入れる。
#     # raw_reply = r.json()["choices"][0]["message"]["content"]

#     result_data = []
#     #　LLM出力は材料ごとに区切るために正規表現で分割してる。
#     patterns = [r"^\s*([^\s\u3000:：]+.*?)\s*[:：]\s*(.+)$"]

#     #　分割して一個一個リストに入れてる
#     for line in raw_reply.splitlines():
#         line = line.strip()
#         for pattern in patterns:
#             match = re.match(pattern, line)
#             if match:
#                 name = match.group(1).strip()
#                 amount = match.group(2).strip()
#                 result_data.append({"name": name, "amount": amount})
#                 break

#     if not result_data:
#         return jsonify({"raw": raw_reply}), 200

#     return jsonify(result_data), 200

# if __name__ == "__main__":
#     port = int(os.getenv("PORT", 5000))
#     app.run(host="0.0.0.0", port=port, debug=True)

# ──────────────────────────────
#  1. .env から環境変数を読む
# ──────────────────────────────
load_dotenv()
API_KEY = os.getenv("API_KEY")  # OpenRouter の API キー
MODEL = "meta-llama/llama-4-maverick:free"

# ──────────────────────────────
#  2. OpenRouter エンドポイント設定
# ──────────────────────────────
API_URL = "https://openrouter.ai/api/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# プロキシが邪魔する環境への対処（なくても OK）
for k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"):
    os.environ.pop(k, None)

# ──────────────────────────────
#  3. Flask 準備
# ──────────────────────────────
app = Flask(__name__, static_folder="public", static_url_path="")

# ログ設定（デバッグしやすいように）
logging.basicConfig(level=logging.DEBUG)


@app.route("/")
def index():
    return app.send_static_file("index.html")


app.register_blueprint(auth.bp)
app.register_blueprint(fridge.bp)
app.register_blueprint(ingredients.bp)
app.register_blueprint(parse_recipe.bp)


# ──────────────────────────────
#  4. /parseRecipe エンドポイント
# ──────────────────────────────
@app.route("/parseRecipe", methods=["POST"])
def handle_parse_recipe():
    data = request.get_json(force=True) or {}
    recipe = data.get("recipe", "").strip()

    if not recipe:
        return jsonify({"error": "recipe text empty"}), 400

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
        # ランキング用メタ情報 (任意)
        "extra_headers": {
            "HTTP-Referer": "https://dshackthon.onrender.com",
            "X-Title": "DSHackthonApp",
        },
    }

    try:
        r = requests.post(API_URL, headers=HEADERS, json=payload, timeout=30)
        r.raise_for_status()
        raw_reply = r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        app.logger.error("LLM API ERROR: %s", e, exc_info=True)
        return jsonify({"error": f"LLM API error: {e}"}), 502

    # ───────── LLM からの回答をパース ─────────
    result = []
    pat = re.compile(r"^\s*([^\s\u3000:：]+.*?)\s*[:：]\s*(.+)$")

    for line in raw_reply.splitlines():
        m = pat.match(line.strip())
        if m:
            result.append({"name": m.group(1).strip(), "amount": m.group(2).strip()})

    if not result:  # パース失敗時は生テキスト返却
        return jsonify({"raw": raw_reply}), 200

    return jsonify(result), 200


# ──────────────────────────────
#  5. アプリ起動
# ──────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
