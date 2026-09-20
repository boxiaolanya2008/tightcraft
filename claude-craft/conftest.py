"""pytest 引导：把项目根与自研引擎(agent-craft/src)挂到 sys.path。

运行时由 run.py 内的 engine._bootstrap 完成；测试环境在 conftest 统一处理。
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent
AGENT = PROJECT.parent / "agent-craft" / "src"

for p in (PROJECT, AGENT):
    if p.is_dir() and str(p) not in sys.path:
        sys.path.insert(0, str(p))