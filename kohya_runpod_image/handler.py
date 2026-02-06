from internal_executor import execute_internal

def handler(event):
    """
    World-Ready Kohya Handler. 
    0 subprocess imports, 0 shell calls.
    """
    input_data = event.get("input", {}) or {}
    # Если ключ не пришел, пробуем запустить probe (проверку)
    cmd_key = input_data.get("command_key", "kohya_probe")
    args = input_data.get("args", []) or []

    try:
        res = execute_internal(cmd_key, args)
        return {
            "state": "COMPLETED" if res.returncode == 0 else "FAILED",
            "stdout": res.stdout[:1000], # Ограничиваем размер лога
            "stderr": res.stderr[:1000],
            "exit_code": res.returncode
        }
    except Exception as e:
        return {"state": "FAILED", "error": str(e)}