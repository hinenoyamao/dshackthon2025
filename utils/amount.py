import re

def to_half(s: str) -> str:
    return ''.join(
        '.' if c == '．' else chr(ord(c) - 0xFEE0) if '０' <= c <= '９' else c
        for c in s)

def parse_amount(text: str) -> dict:
    txt = to_half(text.strip())
    m = re.match(r'^(\d+(?:\.\d+)?)(.*)$', txt)
    return {'num': float(m[1]), 'unit': m[2].strip()} if m else {'num': None, 'unit': txt}

def merge_amounts(base: str, add: str) -> str:
    """文字列で表現された量を統合して1つにする"""
    a1 = parse_amount(base)
    a2 = parse_amount(add)
    if a1["unit"] != a2["unit"]:
        return f"{a1['num']}{a1['unit']} + {a2['num']}{a2['unit']}"
    if a1["num"] is None or a2["num"] is None:
        return f"{a1['unit']}{a2['unit']}"
    return f"{a1['num'] + a2['num']}{a1['unit']}"

