"""流式执行循环：把自研引擎的决策/执行转成 SSE 事件流。

与引擎解耦，但在同项目架构内:
- Workflow:全链路阶段管控(validate->plan->execute->review->finish)
- AccessControl:工具调用前授权(角色=TOOL)
- 应用模式:normal 拒写,accept 放行(写前已读门禁仍生效)
每步工具 yield ToolStart->ToolEnd；收敛文本分块 yield text_delta。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterator

from agentcraft.memory import Memory
from agentcraft.providers import LLMProvider, MockProvider
from agentcraft.tools import Registry, Tool, build_registry
from agentcraft.types import StepObservation, ToolCall, ToolResult

from app import config
from app.access import AccessControl, default_policy
from app.engine import events as ev
from app.engine.events import SSE
from app.engine.pipeline import Stage, Workflow

TOOL_CAPABILITY = {
    "fs_read": "tool.fs_read",
    "fs_list": "tool.fs_list",
    "fs_write": "tool.fs_write",
    "sh_run": "tool.sh_run",
}


@dataclass
class RunResult:
    final: str = ""
    ok: bool = True
    message: str = ""
    steps: int = 0


class _DeniedWrite(Tool):
    """normal 模式下的写门禁：一律拒绝(权限最小化落地)。"""

    name = "fs_write"
    description = "写文件(normal 模式已禁用)"
    params = {"type": "object", "properties": {}}

    def run(self, args: dict[str, Any]) -> str:
        raise PermissionError("normal 模式禁止写文件，请切换到 accept 模式")


def _chunk(text: str, size: int = 12) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)] or [""]


def steps_reached_limit(final: str) -> bool:
    """护栏判定:到达上限且未正常收敛(以护栏文案为准)。"""
    return bool(final) and final.startswith("[护栏]")


class AgentRunner:
    """把一次 Agent 运行暴露为 SSE 迭代器(供网关流式回传)。"""

    def __init__(
        self,
        provider: LLMProvider | None = None,
        *,
        workflow: Workflow | None = None,
        access: AccessControl | None = None,
        mode: str = config.DEFAULT_MODE,
        memory: Memory | None = None,
        root: str = ".",
        max_steps: int = config.MAX_STEPS,
    ) -> None:
        self.provider = provider or MockProvider([])
        self.wf = workflow or Workflow()
        self.access = access or AccessControl(default_policy())
        self.mode = mode
        self.memory = memory or Memory()
        self.root = root
        self.max_steps = max_steps
        self.result = RunResult()

    def iter_run(self, task: str) -> Iterator[SSE]:
        """阶段化推进并逐工具产出事件。"""
        self.result = RunResult()
        final = ""
        steps = 0
        try:
            self.wf.transition(Stage.VALIDATE)
            self.access.guard(config.Role.CORE, "engine.run")
            if not task or not task.strip():
                raise ValueError("task 不能为空")

            reg = self._build_tools()
            self.wf.transition(Stage.PLAN)
            self.wf.transition(Stage.EXECUTE)

            history: list[StepObservation] = []
            for _ in range(self.max_steps):
                decision = self.provider.decide(task, history)
                if decision.is_final:
                    for tok in _chunk(decision.final):
                        yield ev.text_delta(tok)
                    final = decision.final
                    break

                call = decision.tool_call
                assert call is not None
                steps += 1
                cap = TOOL_CAPABILITY.get(call.name)
                result = self._run_tool_checked(call, reg, cap)

                yield ev.tool_start(f"t{steps - 1}", call.name, call.args)
                yield ev.tool_end(
                    f"t{steps - 1}", result.ok,
                    output=result.output, error=result.error,
                )
                history.append(StepObservation(call=call, result=result))
            else:
                final = "[护栏] 未在预算内收敛"

            self.wf.transition(Stage.REVIEW)
            self.wf.transition(Stage.FINISH)
            self.result.final = final
            self.result.steps = steps
            self.result.ok = not steps_reached_limit(final)
            self.result.message = "" if self.result.ok else "护栏中断: 步骤预算已用尽"
            yield ev.done(final)

        except Exception as exc:
            self.result.ok = False
            self.result.message = f"{type(exc).__name__}: {exc}"
            yield ev.error(self.result.message)

    def _build_tools(self) -> Registry:
        reg = build_registry(root=self.root, memory=self.memory)
        if self.mode != config.Mode.ACCEPT_EDITS:
            reg.register(_DeniedWrite())  # 覆盖 fs_write -> 拒写
        return reg

    def _run_tool_checked(self, call: ToolCall, reg: Registry, cap: str | None) -> ToolResult:
        if cap and not self.access.can(config.Role.TOOL, cap):
            return ToolResult(name=call.name, ok=False, error=f"工具 `{call.name}` 越权(需 TOOL 授权)")
        try:
            output = reg.run(call.name, call.args)
            return ToolResult(name=call.name, ok=True, output=output)
        except Exception as exc:
            return ToolResult(name=call.name, ok=False, error=f"{type(exc).__name__}: {exc}")
