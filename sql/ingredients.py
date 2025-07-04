from flask import Blueprint, request, jsonify, g, abort
from db import get_conn, put_conn
from util import parse_amount
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
    name = data.get("name")
    amount = data.get("amount")

    if not name or not amount:
        abort(400, description="Missing name or amount")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO ingredients(user_id, ingredients_name, amount, bought)
        VALUES (%s, %s, %s, false)
    """, (g.user["id"], name, amount))
    conn.commit()
    put_conn(conn)

    return jsonify({"message": "Ingredient added successfully"}), 201