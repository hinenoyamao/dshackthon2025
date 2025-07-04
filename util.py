import re

# 全角数字・全角ドット → 半角
def to_half(s: str) -> str:
    return ''.join(
        '.' if c == '．' else chr(ord(c) - 0xFEE0) if '０' <= c <= '９' else c
        for c in s)

# "1.5kg" → {'num': 1.5, 'unit': 'kg'}
def parse_amount(text: str) -> dict:
    txt = to_half(text.strip())
    m = re.match(r'^(\d+(?:\.\d+)?)(.*)$', txt)
    return {'num': float(m[1]), 'unit': m[2].strip()} if m else {'num': None, 'unit': txt}
