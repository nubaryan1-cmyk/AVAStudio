#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRASH_PATHS = [
    "frontend/app/api/__envcheck",
]
TRASH_PATTERNS = [
    "frontend/app/page.tsx.fix",
    "frontend/app/page.tsx.fix2",
]


def main() -> int:
    found: list[str] = []
    for rel_path in TRASH_PATHS:
        path = ROOT / rel_path
        if path.exists():
            found.append(str(path.relative_to(ROOT)))

    for pattern in TRASH_PATTERNS:
        for match in ROOT.glob(f"{pattern}*"):
            found.append(str(match.relative_to(ROOT)))

    if found:
        print("Found trash files that must be removed:", file=sys.stderr)
        for item in sorted(set(found)):
            print(f" - {item}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
