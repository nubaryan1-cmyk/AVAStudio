# Canon Closure Suite — заметка про Sabotage

## ВАЖНО
Строки вида:
- ✅ NO CANON VIOLATIONS DETECTED
- ❌ CANON VIOLATIONS DETECTED

— это ожидаемое поведение.

## Нормальный режим
В нормальном прогоне suite/canon_gate должен быть:
✅ NO CANON VIOLATIONS DETECTED

## Sabotage режим
Sabotage (например sabotage1_*.log) специально вносит нарушение канона.
Правильное поведение:
❌ CANON VIOLATIONS DETECTED

Это НЕ баг и НЕ ошибка проекта — это проверка, что детект работает.

## Где смотреть подтверждение
Логи: _CANON/_LOGS/
- normal_*.log -> NO VIOLATIONS
- sabotage1_*.log -> VIOLATIONS DETECTED
