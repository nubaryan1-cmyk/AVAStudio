# SABOTAGE-LOGS ARE EXPECTED (NOT A BUG)

If you run: bash run_canon_closure_suite.sh
- In normal mode: CANON GATE must PASS (NO CANON VIOLATIONS).
- In sabotage mode: CANON GATE must FAIL (CANON VIOLATIONS DETECTED). This is GOOD.

Important:
- The line "SABOTAGE X NOT DETECTED" can appear even when violations are detected.
  This is a MESSAGE/ASSERTION bug in the script output, not a canon/core failure.
- The source of truth is:
  "❌ CANON VIOLATIONS DETECTED" + specific violation IDs (e.g. STRING_ERROR_ASSIGN).

Action:
- Do NOT "fix" sabotage failures. They prove the gate catches violations.
