from flask import Blueprint, request, jsonify
import os, requests, re

bp = Blueprint("parse", __name__)

API_KEY = os.getenv("API_KEY")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
MODEL   = "meta-llama/llama-4-scout:free"
USE_DUMMY = os.getenv("USE_DUMMY_LLM", "false").lower() == "true"

@bp.route("/parseRecipe", methods=["POST"])
def parse_recipe():
    recipe = (request.json or {}).get("recipe", "").strip()
    if not recipe:
        return jsonify({"error": "recipe text empty"}), 400
    if USE_DUMMY:
        return jsonify([{"name": "じゃがいも", "amount": "2個"}])
    prompt = f"""
料理名から必要な材料を推測して教えて…
料理名: {recipe}
""".strip()
    r = requests.post("https://openrouter.ai/api/v1/chat/completions",
        headers=HEADERS, json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}]
        }, timeout=30)
    r.raise_for_status()
    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=HEADERS,
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        # 外部 API 側の一過性エラー。アプリ 500 にしない
        return jsonify({"error": "llm_unavailable", "detail": str(e)}), 502
