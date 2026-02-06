import requests
import threading
import time
import random
import csv
import os
import signal
import sys
from concurrent.futures import ThreadPoolExecutor

# КОНФИГУРАЦИЯ
API_URL = "http://localhost:5005"
SECRET = os.getenv("GATEWAY_SECRET")
CONCURRENCY = 20  # Количество одновременных "пользователей"
REPORT_DIR = ros.path.dirname(os.path.abspath(__file__))
DURATION_HOURS = 6

# Статистика
stats = {
    "total": 0,
    "success": 0,
    "errors": 0,
    "avg_latency": 0
}
stats_lock = threading.Lock()
running = True

def signal_handler(sig, frame):
    global running
    print("\n[STOPPING] Graceful shutdown...")
    running = False

signal.signal(signal.SIGINT, signal_handler)

def user_scenario(user_id):
    """Имитация действий пользователя"""
    endpoints = [
        ("/api/v1/photo/generate", {"prompt": f"Photo by user {user_id}", "width": 1024}),
        ("/api/v1/video/generate", {"prompt": f"Video by user {user_id}", "duration": 5}),
        # lora.train обычно реже, делаем с вероятностью 10%
    ]
    
    while running:
        choice = random.choice(endpoints)
        if random.random() < 0.1:
            # Тяжелая задача (LoRA)
            endpoint = "/api/v1/lora/train"
            payload = {"dataset": "http://dummy.zip", "training": {"epochs": 10}}
        else:
            endpoint, payload = choice

        start = time.time()
        try:
            resp = requests.post(
                f"{API_URL}{endpoint}",
                json=payload,
                headers={"X-Gateway-Secret": SECRET},
                timeout=10
            )
            latency = time.time() - start
            
            with stats_lock:
                stats["total"] += 1
                if resp.status_code == 200:
                    stats["success"] += 1
                    # Скользящее среднее
                    stats["avg_latency"] = (stats["avg_latency"] * 0.99) + (latency * 0.01)
                else:
                    stats["errors"] += 1
                    
        except Exception as e:
            with stats_lock:
                stats["errors"] += 1
        
        # Случайная пауза между действиями пользователя (имитация мышления)
        time.sleep(random.uniform(0.5, 2.0))

def main():
    print(f"--- STARTING SOAK TEST ({DURATION_HOURS} HOURS) ---")
    print(f"Concurrency: {CONCURRENCY} threads")
    print(f"Report Dir: {REPORT_DIR}")
    
    os.makedirs(REPORT_DIR, exist_ok=True)
    csv_file = os.path.join(REPORT_DIR, f"report_{int(time.time())}.csv")
    
    # Запускаем потоки
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(user_scenario, i) for i in range(CONCURRENCY)]
        
        start_time = time.time()
        end_time = start_time + (DURATION_HOURS * 3600)
        
        # Цикл мониторинга и записи логов
        with open(csv_file, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Timestamp", "Total", "Success", "Errors", "Avg_Latency_Sec"])
            
            while running and time.time() < end_time:
                time.sleep(10) # Запись каждые 10 секунд
                
                elapsed = int(time.time() - start_time)
                with stats_lock:
                    s = stats.copy()
                
                print(f"[{elapsed}s] Req: {s['total']} | OK: {s['success']} | ERR: {s['errors']} | Lat: {s['avg_latency']:.3f}s")
                writer.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), s["total"], s["success"], s["errors"], f"{s['avg_latency']:.4f}"])
                f.flush()

    print("--- TEST FINISHED ---")

if __name__ == "__main__":
    main()

