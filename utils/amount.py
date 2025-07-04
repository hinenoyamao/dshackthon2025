"""
・数量付き文字列の共通ユーティリティ
"""

import re, unicodedata

_num_re = re.compile(r"^([0-9]+(?:\.[0-9]+)?)(.*)$")


def _zen2han(s: str) -> str:
    """全角数字・記号 → 半角に揃える（NFKC 正規化）"""
    return unicodedata.normalize("NFKC", s)


def parse_amount(text: str) -> tuple[float | None, str]:
    """
    文字列から (数値 or None, 単位文字列) を返す

    >>> parse_amount("２本")   -> (2.0, '本')
    >>> parse_amount("適量")   -> (None, '適量')
    """
    txt = _zen2han(text.strip())
    m = _num_re.match(txt)
    if not m:
        return None, txt
    return float(m.group(1)), m.group(2).strip()


def merge_amounts(base: str, add: str) -> str:
    """
    買い物リスト内で **同一単位の食材を足し合わせる** 用ユーティリティ
    ・単位が同じで両方とも数値化できれば加算
    ・それ以外は “文字列連結” で痕跡を残す
    """
    b_n, b_u = parse_amount(base)
    a_n, a_u = parse_amount(add)
    if b_u == a_u and b_n is not None and a_n is not None:
        total = b_n + a_n
        total_str = str(int(total)) if total.is_integer() else str(total)
        return f"{total_str}{b_u}"
    return f"{base} + {add}"
