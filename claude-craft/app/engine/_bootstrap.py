"""自研引擎内核的接入引导：确保 agentcraft(本仓库自研引擎)可导入。

无第三方依赖；仅做 sys.path 引导，若已安装则直接使用。
"""

from __future__ import annotations

import sys
from pathlib import Path


def _bootstrap() -> None:
    try:
        import agentcraft  # noqa: F401
    except ImportError:
        src = Path(__file__).resolve().parents[3] / "agent-craft" / "src"
        if src.is_dir():
            sys.path.insert(0, str(src))


_bootstrap()
