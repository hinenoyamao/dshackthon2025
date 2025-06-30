# 必要なのは自分でインストールしてね
import requests
import os
from dotenv import load_dotenv

# apikeyは自分で入れる
load_dotenv()
API_KEY = os.getenv("API_KEY")
API_URL = "https://openrouter.ai/api/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 適当にllmに聞きたいこと入れてね
input = ""
prompt = """
料理名から必要な材料を推測して教えて欲しい。
例：料理　カレー
　　人数　2人
　　材料　にんじん1本

カレーに必要な材料は何
"""

payload = {
    "model": "meta-llama/llama-4-scout:free",
    "messages": [
        {"role": "user", "content": prompt}
    ]
}

response = requests.post(API_URL, headers=headers, json=payload)

if response.status_code == 200:
    reply = response.json()["choices"][0]["message"]["content"]
    print("Llama-4-Scoutの応答:\n", reply)
else:
    print("Error:", response.status_code, response.text)
