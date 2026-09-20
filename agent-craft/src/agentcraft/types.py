"""核心类型：消息、工具调用、工具结果、决策。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCall:
    """模型请求执行的一个工具。"""

    name: str
    args: dict[str, Any]


@dataclass
class ToolResult:
    """工具执行结果（副作用之后的观测）。"""

    name: str
    ok: bool
    output: str = ""
    error: str = ""
    fingerprint: str = ""


@dataclass
class Decision:
    """Provider 每步的产出：要么给最终答案，要么请求工具调用。"""

    final: str | None = None
    tool_call: ToolCall | None = None

    @property
    def is_final(self) -> bool:
        return self.final is not None


@dataclass
class StepObservation:
    """一步工具调用的完整记录（供 provider 回溯与记忆）。"""

    call: ToolCall
    result: ToolResult


@dataclass
class Step:
    """规划器产出的一个最小可验证任务单元。"""

    id: str
    goal: str
    requires: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("step id 不能为空")
        if not self.goal:
            raise ValueError("step goal 不能为空")


@dataclass
class Plan:
    """契约化任务拆解结果：DAG 步骤 + 验收标准。"""

    task: str
    steps: list[Step]
    acceptance: str = ""

    def order(self) -> list[Step]:
        """返回拓扑序；有环抛 DAGError。"""
        return _topo_order(self.steps)


class DAGError(ValueError):
    """依赖图含环或悬空引用。"""


def _topo_order(steps: list[Step]) -> list[Step]:
    by_id = {s.id: s for s in steps}
    indeg = {s.id: 0 for s in steps}
    adj: dict[str, list[str]] = {s.id: [] for s in steps}
    for s in steps:
        for r in s.requires:
            if r not in by_id:
                raise DAGError(f"悬空依赖: step `{s.id}` 引用不存在的 `{r}`")
            indeg[s.id] += 1
            adj[r].append(s.id)
    from collections import deque

    queue = deque([sid for sid, d in indeg.items() if d == 0])
    out: list[Step] = []
    while queue:
        sid = queue.popleft()
        out.append(by_id[sid])
        for nxt in adj[sid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
    if len(out) != len(steps):
        raise DAGError("依赖图含环")
    return out