import time
import os
import sys

# === FIX PYTHON PATH ===
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.logger import write, set_progress

job_id = os.environ.get("JOB_ID", "unknown")

out_dir = os.path.join(BASE_DIR, "outputs")
os.makedirs(out_dir, exist_ok=True)

steps = 5
for i in range(steps):
    write(job_id, f"step {i+1}/{steps}")
    set_progress(job_id, int((i+1)/steps*100))
    time.sleep(1)

out_file = os.path.join(out_dir, "lora_real.safetensors")
with open(out_file, "w", encoding="utf-8") as f:
    f.write("REAL GPU LORA RESULT")

write(job_id, "COMPLETED")
print(out_file)
