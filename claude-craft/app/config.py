"""应用配置与边界常量。

集中管理路径、模式、角色划分，作为权限层与流程管控的数据源。
"""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]   # claude-craft/
AGENTCRAFT_SRC = PROJECT_ROOT.parent / "agent-craft" / "src"  # 复用自研引擎
WEB_ROOT = PROJECT_ROOT / "web"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = int(os.environ.get("CRAFT_PORT", "8731"))

# ---- 应用模式(编辑能力范围) ----
class Mode:
    NORMAL = "normal"      # 只读 + 受控工具，不落地写
    ACCEPT_EDITS = "accept"  # 允许按门禁写文件(写前已读)


DEFAULT_MODE = Mode.NORMAL

# ---- 模块角色(权限划分最小集) ----
class Role:
    CORE = "core"        # 引擎/计划
    TOOL = "tool"        # 工具注册与执行
    MEMORY = "memory"    # 记忆/上下文
    GATEWAY = "gateway"  # HTTP 网关/会话
    UI = "ui"            # 前端渲染数据


# ---- 会话上限(护栏) ----
MAX_STEPS = int(os.environ.get("CRAFT_MAX_STEPS", "8"))
THREAD_TITLE_LIMIT = 60
MAX_THREADS = 1000
