from flask import Blueprint, request, jsonify, g, abort
from db import get_conn, put_conn
from utils.amount import parse_amount, merge_amounts
from .fridge import _auth_user

bp = Blueprint("ingredients", __name__, url_prefix="/api/ingredients")

@bp.before_request
def before():
    _auth_user()

# 食材一覧取得（GET）
@bp.route("", methods=["GET"])
def list_ing():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT ingredients_id, ingredients_name, amount, bought
        FROM ingredients
        WHERE user_id = %s
        ORDER BY ingredients_id
    """, (g.user["id"],))
    rows = [{"id": r[0], "name": r[1], "amount": r[2], "bought": r[3]} for r in cur.fetchall()]
    put_conn(conn)
    return jsonify(rows)

# 食材登録（POST）
@bp.route("/add", methods=["POST"])
def add_ing():
    data = request.get_json()
    if not data:
        return jsonify({"error": "no data"}), 400

    name = data.get("name", "").strip()
    amount = data.get("amount", "").strip()
    if not name or not amount:
        return jsonify({"error": "invalid input"}), 400

    conn = get_conn()
    cur = conn.cursor()

    # 同じ名前の食材があるか確認
    cur.execute("SELECT ingredients_id, amount FROM ingredients WHERE user_id=%s AND ingredients_name=%s",
                (g.user["id"], name))
    row = cur.fetchone()

    if row:
        # 既存の量に統合
        new_amount = merge_amounts(row[1], amount)
        cur.execute("UPDATE ingredients SET amount=%s, bought=false WHERE ingredients_id=%s",
                    (new_amount, row[0]))
    else:
        # 新規挿入
        cur.execute("INSERT INTO ingredients (user_id, ingredients_name, amount, bought) VALUES (%s, %s, %s, false)",
                    (g.user["id"], name, amount))

    conn.commit()
    put_conn(conn)
    return jsonify({"status": "ok"})
