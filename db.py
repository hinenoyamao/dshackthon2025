import os, psycopg2, psycopg2.pool
from dotenv import load_dotenv

load_dotenv()

_pool: psycopg2.pool.SimpleConnectionPool | None = None


def get_pool() -> psycopg2.pool.SimpleConnectionPool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        _pool = psycopg2.pool.SimpleConnectionPool(
            1, 5, os.environ["DATABASE_URL"], sslmode="disable"
        )
    return _pool


def get_conn():
    return get_pool().getconn()


def put_conn(conn):
    get_pool().putconn(conn)
