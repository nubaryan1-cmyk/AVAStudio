#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    trufflehog = shutil.which("trufflehog")
    if trufflehog is None:
        print("TruffleHog is required but not installed.", file=sys.stderr)
        print("Install it from https://github.com/trufflesecurity/trufflehog.", file=sys.stderr)
        return 1

    result = subprocess.run(
        [trufflehog, "filesystem", str(ROOT), "--fail", "--no-update"],
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
