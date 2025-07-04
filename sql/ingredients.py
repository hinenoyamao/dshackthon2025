from flask import Blueprint, request, jsonify, g, abort
from db import get_conn, put_conn
from util import parse_amount
from .fridge import _auth_user

bp = Blueprint("ingredients", __name__, url_prefix="/api/ingredients")

@bp.before_request
def before():
    _auth_user()

@bp.route("", methods=["GET"])
def list_ing():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT ingredients_id, ingredients_name, amount, bought
                     FROM ingredients WHERE user_id=%s ORDER BY ingredients_id""",
                (g.user["id"],))
    rows = [{"id": r[0], "name": r[1], "amount": r[2], "bought": r[3]} for r in cur.fetchall()]
    put_conn(conn); return jsonify(rows)

# POST /api/ingredients/add, PATCH /api/ingredients/check, DELETE /api/ingredients/clearBought
# ──> Node の SQL と同じように書けば動きます（省略）
