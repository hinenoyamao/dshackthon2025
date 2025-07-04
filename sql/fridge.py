from flask import Blueprint, request, jsonify, g, abort
from db import get_conn, put_conn
from utils.amount import parse_amount

bp = Blueprint("fridge", __name__, url_prefix="/api/fridge")


# ────────────────────────────────
#  共通：Cookie からユーザーを取り出す
# ────────────────────────────────
def _auth_user():
    from sql.auth import JWT_SECRET
    import jwt, flask

    tok = flask.request.cookies.get("token")
    if not tok:
        abort(401)
    try:
        g.user = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        abort(401)


@bp.before_request
def _before():
    _auth_user()


# ────────────────────────────────
#  1) 一覧
# ────────────────────────────────
@bp.route("", methods=["GET"])
def list_fridge():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT fridge_id, fridge_name, fridge_amount
             FROM fridge WHERE user_id=%s ORDER BY fridge_id""",
        (g.user["id"],),
    )
    rows = [{"id": r[0], "name": r[1], "amount": r[2]} for r in cur.fetchall()]
    put_conn(conn)
    return jsonify(rows)


# ────────────────────────────────
#  2) 追加 / 更新
# ────────────────────────────────
@bp.route("", methods=["POST"])
def add_fridge():
    data = request.get_json() or {}
    name, amount = data.get("name", "").strip(), data.get("amount", "").strip()
    if not name or not amount:
        return jsonify({"error": "invalid"}), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """SELECT fridge_id, fridge_amount
             FROM fridge WHERE user_id=%s AND fridge_name=%s""",
        (g.user["id"], name),
    )
    row = cur.fetchone()

    if row:
        fid, cur_amt = row
        n_cur, u_cur = parse_amount(cur_amt)
        n_add, u_add = parse_amount(amount)

        if n_cur is not None and n_add is not None and u_cur == u_add:
            new_amt = f"{n_cur + n_add:g}{u_cur}"
        else:
            new_amt = f"{cur_amt} + {amount}"

        cur.execute(
            "UPDATE fridge SET fridge_amount=%s WHERE fridge_id=%s",
            (new_amt, fid),
        )
    else:
        cur.execute(
            """INSERT INTO fridge (user_id, fridge_name, fridge_amount)
               VALUES (%s, %s, %s)""",
            (g.user["id"], name, amount),
        )

    conn.commit()
    put_conn(conn)
    return jsonify({"ok": True})


# ────────────────────────────────
#  3) 削除
# ────────────────────────────────
@bp.route("/<int:fid>", methods=["DELETE"])
def delete_fridge(fid):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM fridge WHERE fridge_id=%s AND user_id=%s",
        (fid, g.user["id"]),
    )
    conn.commit()
    put_conn(conn)
    return jsonify({"deleted": True})
