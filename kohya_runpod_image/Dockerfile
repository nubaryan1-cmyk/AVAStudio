# ===============================
# KOHYA SERVERLESS EXECUTOR (PROBE)
# ===============================

FROM runpod/pytorch:2.1.0-py3.10-cuda12.1

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /workspace

# --- system deps ---
RUN apt-get update && apt-get install -y \
    git \
    wget \
    ffmpeg \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# --- python deps ---
RUN pip install --upgrade pip

# --- clone kohya (sd-scripts canonical) ---
RUN git clone https://github.com/kohya-ss/sd-scripts
RUN cd sd-scripts && git checkout 9d0295856488d92636a0c5c30b2c340df9872583.git /workspace/kohya

# --- install kohya requirements ---
RUN pip install -r /workspace/kohya/requirements.txt

# --- sanity check (NO TRAINING) ---
RUN python /workspace/kohya/train_network.py --help

# --- entrypoint (runpod serverless) ---
CMD ["python", "/workspace/handler.py"]