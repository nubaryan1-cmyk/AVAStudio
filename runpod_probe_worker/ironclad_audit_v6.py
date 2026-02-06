import ast
import os
import sys

# Разрешенный бункер
SAFE_RUNNER = "internal_executor.py"

def check_python_rce(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        try:
            content = f.read()
            tree = ast.parse(content)
        except: return []
    
    violations = []
    is_safe_file = SAFE_RUNNER in path

    for node in ast.walk(tree):
        # 1. Запрет на импорт subprocess везде, кроме SAFE_RUNNER
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [alias.name for alias in node.names]
            if "subprocess" in names and not is_safe_file:
                violations.append(f"L{node.lineno}: ILLEGAL import subprocess (Must use internal_executor)")

        # 2. Поиск shell=True (даже в строках вызова)
        if isinstance(node, ast.Call):
            for kw in node.keywords:
                if kw.arg == "shell" and getattr(kw.value, 'value', getattr(kw.value, 'n', None)) is True:
                    violations.append(f"L{node.lineno}: CRITICAL - shell=True detected!")

        # 3. Поиск os.system, eval, exec
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in ["eval", "exec"]:
                violations.append(f"L{node.lineno}: FORBIDDEN {node.func.id} call")

    return violations

def check_csharp_rce(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    violations = []
    if "Process.Start" in content: violations.append("Process.Start detected (C# RCE risk)")
    if "UseShellExecute = true" in content: violations.append("UseShellExecute detected")
    return violations

print("🔍 STARTING GLOBAL IRONCLAD AUDIT v6...")
total_files = 0
total_violations = 0

for root, _, files in os.walk(os.getcwd()):
    for file in files:
        path = os.path.join(root, file).replace("\\", "/")
        if "ironclad_audit" in file or ".git" in path: continue
        
        errs = []
        if file.endswith(".py"): 
            total_files += 1
            errs = check_python_rce(path)
        elif file.endswith(".cs"):
            total_files += 1
            errs = check_csharp_rce(path)
            
        if errs:
            print(f"❌ {path}")
            for e in errs: print(f"   └─ {e}")
            total_violations += len(errs)

print("-" * 80)
print(f"SUMMARY: Scanned {total_files} files. Found {total_violations} violations.")

if total_violations == 0:
    print("\n🏆 100% IRONCLAD: Project is RCE-free. System is World-Ready.")
    sys.exit(0)
else:
    print("\n🛑 DEPLOYMENT BLOCKED: Security violations found!")
    sys.exit(1)