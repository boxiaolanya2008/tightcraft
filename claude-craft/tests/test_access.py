"""权限划分测试：授权命中与越权拒绝。"""

from __future__ import annotations

import pytest

from app.access import AccessControl, AccessDenied, default_policy
from app.config import Role


def make() -> AccessControl:
    return AccessControl(default_policy())


def test_authorized_tool_write():
    ac = make()
    ac.guard(Role.TOOL, "tool.fs_write")  # 不应抛


def test_cross_role_denied():
    ac = make()
    with pytest.raises(AccessDenied):
        ac.guard(Role.GATEWAY, "tool.fs_write")  # 网关不可直接执行工具


def test_core_cannot_use_gateway_things():
    ac = make()
    with pytest.raises(AccessDenied):
        ac.guard(Role.CORE, "gateway.threads.read")  # 引擎不可越域读写会话


def test_can_query():
    ac = make()
    assert ac.can(Role.CORE, "engine.run") is True
    assert ac.can(Role.UI, "engine.run") is False


def test_bulk_grant():
    ac = make()
    ac.bulk_grants({"feature.z": ["core", "tool"]})
    assert ac.can(Role.TOOL, "feature.z")
    with pytest.raises(AccessDenied):
        ac.guard(Role.MEMORY, "feature.z")
