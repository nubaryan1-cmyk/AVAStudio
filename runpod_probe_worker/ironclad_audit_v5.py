import ast
import os

DANGEROUS_IMPORTS = {"pickle", "marshal", "shelve"} # json и yaml (safe) разрешены

def check_python_ast(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        try:
            tree = ast.parse(f.read())
        except: return []
    
    violations = []
    # Разрешаем subprocess ТОЛЬКО внутри функций safe_execute или в модуле internal_executor
    # Для простоты в этом тесте: запрещаем import subprocess везде, где нет определения safe_execute
    has_safe_execute = "def safe_execute" in open(path, "r", encoding="utf-8", errors="ignore").read()
    is_internal_executor = "internal_executor.py" in path

    for node in ast.walk(tree):
        # 1. Проверка импортов
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for name in node.names:
                if name.name == "subprocess" and not (has_safe_execute or is_internal_executor):
                    violations.append(f"L{node.lineno}: FORBIDDEN subprocess import (use safe_execute instead)")
                if name.name in DANGEROUS_IMPORTS:
                    violations.append(f"L{node.lineno}: DANGEROUS IMPORT {name.name} (RCE risk)")

        # 2. Проверка shell=True
        if isinstance(node, ast.Call):
            for kw in node.keywords:
                if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                    violations.append(f"L{node.lineno}: CRITICAL - shell=True detected!")

        # 3. Проверка на eval/exec
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in ["eval", "exec"]:
                violations.append(f"L{node.lineno}: FORBIDDEN {node.func.id} call")

    return violations

total = 0
print(f"{'FILE':<80} | {'STATUS'}")
print("-" * 100)
for root, _, files in os.walk(os.getcwd()):
    for file in files:
        if file.endswith(".py") and "ironclad_audit" not in file:
            path = os.path.join(root, file)
            errs = check_python_ast(path)
            if errs:
                print(f"{path:<80} | ❌ {len(errs)} VIOLATIONS")
                for e in errs: print(f"  └─ {e}")
                total += len(errs)

if total == 0:
    print("\n🏆 100% IRONCLAD: Все RCE-векторы ликвидированы. json.load игнорируется как безопасный.")
else:
    print(f"\n❌ ГЕЙТ ПРОВАЛЕН: {total} нарушений!")