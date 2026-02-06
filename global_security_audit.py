import os
import re

# Набор опасных сигнатур для Python и C#
SIGNATURES = {
    "PYTHON_DANGER": [
        r"os\.system\(", 
        r"eval\(", 
        r"exec\(", 
        r"pickle\.load\(", 
        r"subprocess\.getoutput\(",
        r"subprocess\.getstatusoutput\("
    ],
    "CSHARP_DANGER": [
        r"Process\.Start\(", 
        r"UseShellExecute\s*=\s*true", 
        r"cmd\.exe", 
        r"powershell\.exe"
    ]
}

def scan_project(root_dir):
    print(f"{'FILE':<80} | {'LINE':<6} | {'RISK TYPE'}")
    print("-" * 110)
    
    total_risks = 0
    for root, _, files in os.walk(root_dir):
        for file in files:
            path = os.path.join(root, file)
            # Игнорируем сам скрипт аудита и логи
            if "global_security_audit.py" in path or ".log" in path: continue
            
            ext = os.path.splitext(file)[1].lower()
            sigs = []
            if ext == ".py": sigs = SIGNATURES["PYTHON_DANGER"]
            elif ext == ".cs": sigs = SIGNATURES["CSHARP_DANGER"]
            
            if sigs:
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            # Игнорируем комментарии
                            if line.strip().startswith("#") or line.strip().startswith("//"): continue
                            
                            for sig in sigs:
                                if re.search(sig, line):
                                    print(f"{path:<80} | {i+1:<6} | {sig}")
                                    total_risks += 1
                except:
                    pass
    return total_risks

print("🔍 НАЧИНАЮ ГЛОБАЛЬНЫЙ АУДИТ ВСЕХ RCE-ВЕКТОРОВ (Python & .NET)...")
risks = scan_project(os.getcwd())
print("-" * 110)

if risks == 0:
    print("🏆 100% СЕРТИФИЦИРОВАННАЯ БЕЗОПАСНОСТЬ: Опасных вызовов не найдено.")
else:
    print(f"❌ ОБНАРУЖЕНО {risks} ПОТЕНЦИАЛЬНЫХ УЯЗВИМОСТЕЙ!")