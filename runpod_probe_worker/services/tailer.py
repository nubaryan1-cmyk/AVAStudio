import os
from collections import deque

def tail(file_path, n=20):
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        return list(deque(f, maxlen=n))
