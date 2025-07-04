from flask import Blueprint, request, jsonify, g, abort
from db import get_conn, put_conn
from utils.amount import parse_amount, merge_amounts
from .fridge import _auth_user

bp = Blueprint("ingredients", __name__, url_prefix="/api/ingredients")


@bp.before_request
def _before():
    _auth_user()


# ─────────────────────────────
#  ヘルパ：冷蔵庫へ「足りない分だけ上書き」
# ─────────────────────────────
def _upsert_fridge(cur, uid: int, name: str, need_amt: str):
    """
    ・同名食材が冷蔵庫に有れば「最終量 = max(現在量, 必要量)」
    ・無ければ INSERT
    """
    cur.execute(
        """SELECT fridge_id, fridge_amount
             FROM fridge WHERE user_id=%s AND fridge_name=%s""",
        (uid, name),
    )
    row = cur.fetchone()

    if row:
        fid, cur_amt = row
        n_cur, u_cur = parse_amount(cur_amt)
        n_need, u_need = parse_amount(need_amt)

        if n_cur is not None and n_need is not None and u_cur == u_need:
            final = max(n_cur, n_need)
            final_str = str(int(final)) if final.is_integer() else str(final)
            new_amt = f"{final_str}{u_cur}"
        else:
            new_amt = f"{cur_amt} → {need_amt}"

        cur.execute(
            "UPDATE fridge SET fridge_amount=%s WHERE fridge_id=%s",
            (new_amt, fid),
        )
    else:
        cur.execute(
            """INSERT INTO fridge (user_id, fridge_name, fridge_amount)
               VALUES (%s,%s,%s)""",
            (uid, name, need_amt),
        )


# ─────────────────────────────
#  1) 一覧
# ─────────────────────────────
@bp.route("", methods=["GET"])
def list_ing():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT ingredients_id, ingredients_name, amount, bought
             FROM ingredients
            WHERE user_id=%s
            ORDER BY ingredients_id""",
        (g.user["id"],),
    )
    rows = [
        {"id": r[0], "name": r[1], "amount": r[2], "bought": r[3]}
        for r in cur.fetchall()
    ]
    put_conn(conn)
    return jsonify(rows)


# ─────────────────────────────
#  2) 追加 / マージ
# ─────────────────────────────
@bp.route("/add", methods=["POST"])
def add_ing():
    data = request.get_json() or {}
    name, amount = data.get("name", "").strip(), data.get("amount", "").strip()
    if not name or not amount:
        return jsonify({"error": "invalid input"}), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """SELECT ingredients_id, amount
             FROM ingredients
            WHERE user_id=%s AND ingredients_name=%s""",
        (g.user["id"], name),
    )
    row = cur.fetchone()

    if row:
        ing_id, cur_amt = row
        new_amt = merge_amounts(cur_amt, amount)
        cur.execute(
            "UPDATE ingredients SET amount=%s, bought=false WHERE ingredients_id=%s",
            (new_amt, ing_id),
        )
    else:
        cur.execute(
            """INSERT INTO ingredients(user_id, ingredients_name, amount, bought)
               VALUES (%s,%s,%s,false)""",
            (g.user["id"], name, amount),
        )

    conn.commit()
    put_conn(conn)
    return jsonify({"ok": True})


# ─────────────────────────────
#  3) チェック更新
# ─────────────────────────────
@bp.route("/check", methods=["PATCH"])
def check_ing():
    data = request.get_json() or {}
    ing_id = data.get("id")
    checked = bool(data.get("checked"))
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE ingredients SET bought=%s WHERE ingredients_id=%s AND user_id=%s",
        (checked, ing_id, g.user["id"]),
    )
    conn.commit()
    put_conn(conn)
    return jsonify({"ok": True})


# ─────────────────────────────
#  4) clearBought
#      ✔ 行を まとめて冷蔵庫へ転送し、元リストから削除
# ─────────────────────────────
@bp.route("/clearBought", methods=["DELETE"])
def clear_bought():
    conn = get_conn()
    cur = conn.cursor()

    # a) “買った” 行を取得
    cur.execute(
        """SELECT ingredients_name, amount
             FROM ingredients
            WHERE user_id=%s AND bought=true""",
        (g.user["id"],),
    )
    rows = cur.fetchall()

    # b) 冷蔵庫テーブルへ upsert
    for name, amt in rows:
        _upsert_fridge(cur, g.user["id"], name, amt)

    # c) 削除
    cur.execute(
        "DELETE FROM ingredients WHERE user_id=%s AND bought=true",
        (g.user["id"],),
    )

    conn.commit()
    put_conn(conn)
    return jsonify({"ok": True, "moved": len(rows)})
