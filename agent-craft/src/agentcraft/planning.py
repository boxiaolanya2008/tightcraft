"""规划器：契约化拆解 + 依赖 DAG 校验 + 拓扑序。

把任务拆成最小可验证单元(Step)，每个带验收出口；用拓扑序给出可执行顺序。
环/悬空依赖立即抛错，不改动即进入执行。
"""

from __future__ import annotations

from typing import Callable

from agentcraft.types import DAGError, Plan, Step


def decompose(task: str, break_down: Callable[[str], list[Step]] | None = None) -> Plan:
    """以默认启发式拆解；可用 break_down 覆盖自定义拆解逻辑。"""
    steps = break_down(task) if break_down else _heuristic_decompose(task)
    _validate(steps)
    return Plan(task=task, steps=steps, acceptance=f"全部 {len(steps)} 步按序完成且验收通过")


def _validate(steps: list[Step]) -> None:
    ids = {s.id for s in steps}
    if len(ids) != len(steps):
        raise DAGError("步骤 id 重复")
    for s in steps:
        unknown = [r for r in s.requires if r not in ids]
        if unknown:
            raise DAGError(f"step `{s.id}` 悬空依赖: {unknown}")


def _heuristic_decompose(task: str) -> list[Step]:
    """无自定义拆解时的保守规划：读资源 → 产出 → 验收。"""
    return [
        Step(id="collect", goal=f"收集 {task} 所需输入/资源", requires=[]),
        Step(id="implement", goal=f"产出 {task} 的可交付成果", requires=["collect"]),
        Step(id="verify", goal=f"对 {task} 成果做验收回归", requires=["implement"]),
    ]


def execute_plan(plan: Plan, run_step: Callable[[Step], None]) -> list[str]:
    """按拓扑序执行，记录完成顺序；任一步抛错即中断。"""
    done: list[str] = []
    for step in plan.order():
        run_step(step)
        done.append(step.id)
    return done