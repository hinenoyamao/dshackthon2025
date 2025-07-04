from flask import Blueprint, request, jsonify, current_app as app
from db import get_conn, put_conn
import bcrypt, jwt, os

bp = Blueprint("auth", __name__, url_prefix="/auth")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")

def _issue_token(user_id, name):
    return jwt.encode({"id": user_id, "name": name}, JWT_SECRET, algorithm="HS256")

@bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    name, password = data.get("name"), data.get("password")
    if not name or not password:
        return jsonify({"error": "name/pass required"}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE user_name=%s", (name,))
        if cur.fetchone():
            return jsonify({"error": "duplicate"}), 409
        cur.execute(
            "INSERT INTO users(user_name,password) VALUES(%s,%s)",
            (name, bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()))
        conn.commit()
    finally:
        put_conn(conn)
    return jsonify({"ok": True})

@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    name, password = data.get("name"), data.get("password")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT user_id,password FROM users WHERE user_name=%s", (name,))
        row = cur.fetchone()
        if not row or not bcrypt.checkpw(password.encode(), row[1].encode()):
            return jsonify({"error": "invalid"}), 400
        token = _issue_token(row[0], name)
    finally:
        put_conn(conn)
    resp = jsonify({"ok": True, "name": name})
    resp.set_cookie("token", token, httponly=True, max_age=7*24*60*60)
    return resp

@bp.route("/me")
def me():
    tok = request.cookies.get("token")
    if not tok:
        return jsonify({"user": None})
    try:
        payload = jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])
        return jsonify({"user": {"id": payload["id"], "name": payload["name"]}})
    except jwt.InvalidTokenError:
        return jsonify({"user": None})

@bp.route("/logout", methods=["POST"])
def logout():
    resp = jsonify({"ok": True})
    resp.delete_cookie("token")
    return resp
