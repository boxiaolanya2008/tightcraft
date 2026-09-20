"""Agent 执行循环：plan -> act(tool) -> observe -> loop，带护栏与失败恢复。"""

from __future__ import annotations

from agentcraft.memory import Memory
from agentcraft.providers import LLMProvider
from agentcraft.tools import Registry, build_registry
from agentcraft.types import Decision, StepObservation, ToolCall, ToolResult


class Agent:
    """单 Agent 执行器。

    - max_steps：全局护栏，防 runaway。
    - retries：单个工具失败后的重试上限(带指数退避)。
    - memory/gates：写前已读等安全门禁由工具层实施。
    """

    def __init__(
        self,
        provider: LLMProvider,
        tools: Registry | None = None,
        memory: Memory | None = None,
        root: str = ".",
        max_steps: int = 8,
        retries: int = 1,
    ) -> None:
        self.provider = provider
        self.tools = tools if tools is not None else None
        self.memory = memory if memory is not None else Memory()
        self.root = root
        self.max_steps = max_steps
        self.retries = retries
        self.history: list[StepObservation] = []
        self.result: ToolResult | None = None

    def ensure_tools(self) -> Registry:
        """惰性装配工具(根目录固定，写工具共享 memory 指纹门禁)。"""
        if self.tools is None:
            self.tools = build_registry(root=self.root, memory=self.memory.reads())
        return self.tools

    def execute(self, task: str) -> str:
        self.history = []
        reg = self.ensure_tools()
        for step in range(1, self.max_steps + 1):
            decision = self._safe_decide(task)
            if decision.is_final:
                self.result = None
                return decision.final
            assert decision.tool_call is not None
            result = self._run_with_retry(decision.tool_call, reg)
            self.history.append(StepObservation(call=decision.tool_call, result=result))
            if result.ok:
                # 命中一个可交付动作后仍继续，直到 provider 收敛给 final
                continue
            # 工具失败：provider 下一轮应给出修复/换路径；护栏兜底 max_steps
        return self._build_deadline_message()

    def _safe_decide(self, task: str) -> Decision:
        try:
            return self.provider.decide(task, self.history)
        except Exception as exc:  # 外部 Provider 异常不得击穿循环
            return Decision(final=f"[provider 异常] {type(exc).__name__}: {exc}")

    def _run_with_retry(self, call: ToolCall, reg: Registry) -> ToolResult:
        backoff = 0
        for attempt in range(self.retries + 1):
            try:
                output = reg.run(call.name, call.args)
                # 指纹由 fs_read 工具自身记入与写工具共享的 live tracker
                return ToolResult(name=call.name, ok=True, output=output)
            except PermissionError as exc:
                # 安全门禁命中：不给自动重试，交由模型换路径(高优先)。
                return ToolResult(name=call.name, ok=False, error=str(exc))
            except Exception as exc:
                if attempt >= self.retries:
                    return ToolResult(name=call.name, ok=False, error=f"{type(exc).__name__}: {exc}")
                time_sleep(backoff)
                backoff = backoff + 1 or 1
        raise AssertionError("unreachable")

    def _build_deadline_message(self) -> str:
        ok = sum(1 for h in self.history if h.result.ok)
        fail = len(self.history) - ok
        return (f"[护栏] 已到 max_steps={self.max_steps}。执行 {ok} 成功 / {fail} 失败。"
                f"未在预算内收敛，需降级或换策略。")


def time_sleep(seconds: float) -> None:
    import time

    time.sleep(seconds)