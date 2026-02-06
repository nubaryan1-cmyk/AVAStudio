import os
import psycopg2
from dotenv import load_dotenv

# Загружаем конфиги из .env.staging
load_dotenv(".env.staging")

def migrate():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ ОШИБКА: DATABASE_URL не найден в .env.staging!")
        return

    print(f"🌍 Попытка подключения к Supabase...")
    
    schema = """
    -- 1. Таблица профилей пользователей
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        plan TEXT DEFAULT 'FREE',
        stripe_customer_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 2. Таблица задач (Критически важно для Ядра)
    CREATE TABLE IF NOT EXISTS jobs (
        job_id UUID PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id),
        job_type TEXT NOT NULL,
        state TEXT NOT NULL,
        ssot_version TEXT DEFAULT '1.1',
        payload_json JSONB NOT NULL,
        result_json JSONB,
        priority INTEGER DEFAULT 5,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        finished_at TIMESTAMP WITH TIME ZONE
    );

    -- 3. Реестр LoRA пользователя
    CREATE TABLE IF NOT EXISTS user_loras (
        lora_id UUID PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id),
        name TEXT NOT NULL,
        s3_key TEXT NOT NULL,
        trigger_word TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """

    try:
        # Подключаемся
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("🛠️ Создаю таблицы...")
        cur.execute(schema)
        
        print("🏆 УСПЕХ! Архитектура AVAStudio теперь развернута в Облаке.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ ОШИБКА: {e}")

if __name__ == "__main__":
    migrate()