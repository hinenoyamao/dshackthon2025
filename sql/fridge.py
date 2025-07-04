from flask import Blueprint, request, jsonify, g
from db import get_conn, put_conn
from util import parse_amount

bp = Blueprint("fridge", __name__, url_prefix="/api/fridge")

def _auth_user():
    # auth/me と同じロジック簡易版
    from sql.auth import JWT_SECRET
    import jwt, flask
    tok = flask.request.cookies.get("token")
    if not tok:
        flask.abort(401)
    try:
        g.user = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        flask.abort(401)

@bp.before_request
def before():
    _auth_user()

@bp.route("", methods=["GET"])
def list_fridge():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT fridge_id, fridge_name, fridge_amount
                     FROM fridge WHERE user_id=%s ORDER BY fridge_id""",
                (g.user["id"],))
    rows = [{"id": r[0], "name": r[1], "amount": r[2]} for r in cur.fetchall()]
    put_conn(conn)
    return jsonify(rows)

@bp.route("", methods=["POST"])
def add_fridge():
    data = request.get_json() or {}
    name, amount = data.get("name"), data.get("amount")
    conn = get_conn(); cur = conn.cursor()
    # 同名行チェック
    cur.execute("""SELECT fridge_id, fridge_amount FROM fridge
                    WHERE user_id=%s AND fridge_name=%s""",
                (g.user["id"], name))
    ex = cur.fetchone()
    if ex:
        cur_am, add_am = parse_amount(ex[1]), parse_amount(amount)
        merged = (cur_am["num"] is not None and add_am["num"] is not None
                  and cur_am["unit"] == add_am["unit"])
        new_amount = f"{cur_am['num'] + add_am['num']}{cur_am['unit']}" if merged \
                     else f"{ex[1]} + {amount}"
        cur.execute("UPDATE fridge SET fridge_amount=%s WHERE fridge_id=%s",
                    (new_amount, ex[0]))
        conn.commit()
        put_conn(conn)
        return jsonify({"id": ex[0], "merged": True})
    # 新規
    cur.execute("""INSERT INTO fridge(user_id,fridge_name,fridge_amount)
                    VALUES(%s,%s,%s) RETURNING fridge_id""",
                (g.user["id"], name, amount))
    fid = cur.fetchone()[0]
    conn.commit(); put_conn(conn)
    return jsonify({"id": fid, "merged": False})

@bp.route("/<int:fid>", methods=["DELETE"])
def delete_fridge(fid):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM fridge WHERE fridge_id=%s AND user_id=%s",
                (fid, g.user["id"]))
    conn.commit(); put_conn(conn)
    return jsonify({"deleted": True})
