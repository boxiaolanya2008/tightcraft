"""模块权限划分：自研访问控制层。

以「角色(module role)」为最小授权单元，通过策略表决定某角色能否调用某能力。
网关(gateway)执行前一律过 guard()：无权限即抛 AccessDenied，阻断越域调用。
本层独立于引擎与 UI，保证任何入口(HTTP/测试)都不绕过授权检查。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from app.config import Role


class AccessDenied(PermissionError):
    """越权访问被拒绝。"""

    def __init__(self, capability: str, role: str) -> None:
        self.capability = capability
        self.role = role
        super().__init__(f"角色 `{role}` 无权调用能力 `{capability}`")


@dataclass
class PermissionPolicy:
    """策略表:能力 -> 允许的角色集合。空集合=任何角色都不可用。"""

    grants: dict[str, set[str]] = field(default_factory=dict)

    def allow(self, capability: str, *roles: str) -> None:
        self.grants.setdefault(capability, set()).update(roles)

    def bulk_grants(self, table: dict[str, list[str]]) -> None:
        for cap, roles in table.items():
            self.allow(cap, *roles)


class AccessControl:
    """授权守卫。每个 module 持有其身份 role，调用能力前传 identity 校验。"""

    def __init__(self, policy: PermissionPolicy) -> None:
        self._policy = policy

    def grant(self, capability: str, *roles: str) -> None:
        self._policy.allow(capability, *roles)

    def bulk_grants(self, table: dict[str, list[str]]) -> None:
        self._policy.bulk_grants(table)

    def can(self, role: str, capability: str) -> bool:
        allowed = self._policy.grants.get(capability, set())
        return role in allowed

    def guard(self, role: str, capability: str) -> None:
        if not self.can(role, capability):
            raise AccessDenied(capability, role)


def grant_guard(role: str, ac: AccessControl):
    """装饰器:包一层带固定身份的打点函数，供注入使用。"""

    def decorate(capability: str):
        return lambda: ac.guard(role, capability)

    return decorate


def default_policy() -> PermissionPolicy:
    """默认授权:工具执行仅 TOOL;引擎仅 CORE;网关读写仅 GATEWAY;记忆仅 MEMORY。"""
    p = PermissionPolicy()
    table = {
        # 能力名                    -> 可调用角色
        "engine.run":               [Role.CORE],
        "engine.plan":              [Role.CORE],
        "tool.fs_read":             [Role.TOOL, Role.CORE],
        "tool.fs_write":            [Role.TOOL],
        "tool.fs_list":             [Role.TOOL, Role.CORE],
        "tool.sh_run":              [Role.TOOL],
        "memory.latch":             [Role.MEMORY, Role.CORE],
        "memory.invalidate":        [Role.MEMORY],
        "gateway.threads.read":     [Role.GATEWAY],
        "gateway.threads.write":    [Role.GATEWAY],
        "gateway.stream":           [Role.GATEWAY],
        "ui.emit":                  [Role.CORE, Role.UI],
    }
    p.bulk_grants(table)
    return p


__all__ = ["AccessControl", "AccessDenied", "PermissionPolicy", "default_policy", "grant_guard"]
