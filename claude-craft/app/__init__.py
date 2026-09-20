"""claude-craft：自研 Agent 应用(GUI/Web)。

注:本项目复用先前在本仓库自研的 agentcraft 引擎内核，非任何开源方案；
本项目自身的工程体系(HTTP 网关/权限层/流程管控/界面/校验)全部自研。
"""

from app import access, config
from app.access import AccessControl, AccessDenied, default_policy
from app.config import Mode, Role

__all__ = ["access", "config", "AccessControl", "AccessDenied", "default_policy", "Mode", "Role"]
__version__ = "0.1.0"
