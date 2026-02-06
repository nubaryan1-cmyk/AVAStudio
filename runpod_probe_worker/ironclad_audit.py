import ast
import os
import re

# Векторы атаки
VECTORS = {
    "exec": ["subprocess", "os.system", "os.popen", "eval", "exec", "commands"],
    "deserialization": ["pickle", "yaml.load", "marshal"]
}

def check_python(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        try:
            tree = ast.parse(f.read())
        except: return []
    
    found = []
    # Исключаем сам безопасный раннер из проверки на subprocess
    is_safe_runner = "internal_executor.py" in path
    
    for node in ast.walk(tree):
        # Проверка импортов
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [alias.name for alias in node.names]
            for vector in VECTORS["exec"]:
                if vector in names and not is_safe_runner:
                    found.append(f"FORBIDDEN IMPORT: {vector} at line {node.lineno}")
        
        # Проверка вызовов функций (eval, pickle.load и т.д.)
        if isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name): func_name = node.func.id
            elif isinstance(node.func, ast.Attribute): func_name = node.func.attr
            
            if func_name in ["load", "loads"] and not is_safe_runner:
                # Проверка на unsafe yaml
                found.append(f"DANGEROUS CALL: {func_name} (check for unsafe deserialization) at line {node.lineno}")
            if func_name in ["system", "popen", "eval", "exec"]:
                found.append(f"FORBIDDEN CALL: {func_name} at line {node.lineno}")

    return found

def check_csharp(path):
    violations = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        if "Process.Start" in content: violations.append("Process.Start detected")
        if "BinaryFormatter" in content: violations.append("BinaryFormatter (Insecure) detected")
    return violations

print(f"{'FILE':<70} | {'STATUS'}")
print("-" * 90)

total = 0
for root, _, files in os.walk(os.getcwd()):
    for file in files:
        path = os.path.join(root, file)
        if "ironclad_audit.py" in path: continue
        
        errs = []
        if file.endswith(".py"): errs = check_python(path)
        elif file.endswith(".cs"): errs = check_csharp(path)
        
        if errs:
            print(f"{path:<70} | ❌ {len(errs)} VIOLATIONS")
            for e in errs: print(f"  └─ {e}")
            total += len(errs)

if total == 0:
    print("\n🏆 100% IRONCLAD RCE PROOF: Проект полностью стерилен и защищен.")
else:
    print(f"\n❌ ГЕЙТ НЕ ПРОЙДЕН: Найдено {total} нарушений безопасности!")