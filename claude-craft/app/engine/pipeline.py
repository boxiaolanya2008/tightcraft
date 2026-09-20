"""全链路流程管控：自研阶段状态机。

把一次 Agent 运行建模为不可逆的阶段链：
    validate -> plan -> execute -> review -> finish
控制器只允许合法转移；每步转移写入审计轨迹(audit trail)。
比"随处 side-effect"的写法更可读、可测试、稳定。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Stage(str, Enum):
    IDLE = "idle"
    VALIDATE = "validate"   # 入参/权限/边界校验
    PLAN = "plan"           # 契约化拆解
    EXECUTE = "execute"     # 工具执行循环
    REVIEW = "review"       # 收尾复核(护栏/结果)
    FINISH = "finish"       # 完成


class IllegalTransition(RuntimeError):
    """状态机非法转移(视为缺陷中断)。"""


_ALLOWED: dict[Stage, set[Stage]] = {
    Stage.IDLE: {Stage.VALIDATE},
    Stage.VALIDATE: {Stage.PLAN},
    Stage.PLAN: {Stage.EXECUTE},
    Stage.EXECUTE: {Stage.REVIEW},
    Stage.REVIEW: {Stage.FINISH},
    Stage.FINISH: set(),  # 终态不可再转
}


@dataclass
class AuditEntry:
    stage_from: Stage
    stage_to: Stage
    note: str = ""


class Workflow:
    """全链路阶段控制器。idx 提供双向遍历与原子转移。"""

    def __init__(self) -> None:
        self._stage: Stage = Stage.IDLE
        self._audit: list[AuditEntry] = []

    @property
    def stage(self) -> Stage:
        return self._stage

    @property
    def audit(self) -> list[AuditEntry]:
        return list(self._audit)

    def can(self, stage: Stage) -> bool:
        return stage in _ALLOWED[self._stage]

    def try_move(self, stage: Stage, note: str = "") -> bool:
        if not self.can(stage):
            return False
        self.transition(stage, note)
        return True

    def transition(self, stage: Stage, note: str = "") -> None:
        """强制转移；非法则抛 IllegalTransition(测试可验证拒绝)。"""
        if stage not in _ALLOWED[self._stage]:
            raise IllegalTransition(f"非法转移: {self._stage.value} -> {stage.value}")
        self._audit.append(AuditEntry(self._stage, stage, note))
        self._stage = stage

    def reset(self) -> None:
        self._stage = Stage.IDLE
        self._audit.clear()


def run_pipeline(run_step: "object", *, workflow: Workflow | None = None):
    """按阶段链推进并写审计。run_step(stage, token) 提供扩展点。"""
    wf = workflow or Workflow()
    for stage in (Stage.VALIDATE, Stage.PLAN, Stage.EXECUTE, Stage.REVIEW, Stage.FINISH):
        wf.transition(stage)
        on_stage = getattr(run_step, stage.value, None)
        if callable(on_stage):
            on_stage()
    return wf
