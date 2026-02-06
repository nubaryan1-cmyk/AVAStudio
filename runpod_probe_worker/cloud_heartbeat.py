import os
import psycopg2
from dotenv import load_dotenv

# Загружаем из нового места
load_dotenv(".env.staging.local")

def check_heartbeat():
    url = os.getenv("DATABASE_URL")
    print(f"📡 Пробую связаться с Облаком (Direct Connect)...")
    try:
        # Устанавливаем короткий таймаут 5 сек
        conn = psycopg2.connect(url, connect_timeout=5)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM users;")
        count = cur.fetchone()[0]
        print(f"💓 ПУЛЬС ЕСТЬ! Облако ответило. В таблице users: {count} записей.")
        conn.close()
    except Exception as e:
        print(f"💔 ПУЛЬСА НЕТ (DNS Error): {e}")
        print("\n💡 Если видишь 'translate host name' - это DNS твоего провайдера.")

if __name__ == "__main__":
    check_heartbeat()