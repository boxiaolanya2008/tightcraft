"""Provider 抽象：把"决定下一步"与"工具执行"解耦。

HTTPProvider 走 OpenAI 兼容 chat/completions（函数调用），零第三方依赖(urllib)。
MockProvider 离线、可脚本化，用于测试与离线演示。
"""

from __future__ import annotations

import json
import urllib.request
from abc import ABC, abstractmethod
from typing import Any, Callable

from agentcraft.types import Decision, StepObservation, ToolCall, ToolResult


class LLMProvider(ABC):
    """决策接口：给定任务与已走历史，返回下一步决策。"""

    @abstractmethod
    def decide(self, task: str, history: list[StepObservation]) -> Decision:
        raise NotImplementedError


class MockProvider(LLMProvider):
    """脚本化 provider：按预置脚本推进，离线下确定性可用。

    steps 每项是 Callable(history) -> Decision，或直接 Decision。
    """

    def __init__(self, steps: list[Any] | None = None) -> None:
        self._steps: list[Callable[[list[StepObservation]], Decision] | Decision] = list(steps or [])
        self.calls = 0

    def decide(self, task: str, history: list[StepObservation]) -> Decision:
        self.calls += 1
        if not self._steps:
            return Decision(final=f"[mock] 无更多步骤，历史 {len(history)} 条")
        # 一次性 Decision 每次调用消费一个；callable 视为持久化决策函数，反复调用
        while self._steps and not callable(self._steps[0]):
            return self._coerce(self._steps.pop(0))
        value = self._steps[0](history)
        return self._coerce(value)

    @staticmethod
    def _coerce(value: Any) -> Decision:
        if isinstance(value, Decision):
            return value
        if isinstance(value, str):
            return Decision(final=value)
        raise TypeError(f"mock 步骤产出必须是 Decision 或 str，收到 {type(value).__name__}")


def _tool_call(name: str, **args) -> Decision:
    return Decision(tool_call=ToolCall(name=name, args=args))


class OpenAIProvider(LLMProvider):
    """OpenAI 兼容端点，真实 Agent 决策。需 base_url/api_key/model。

    通过 tools_schema 提供函数调用；解析响应的 tool_calls。
    零第三方依赖：用 urllib。max_steps 由 Agent 全局护栏兜底。
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        tools: list[dict[str, Any]] | None = None,
        timeout: int = 120,
    ) -> None:
        if not api_key:
            raise ValueError("api_key 必填")
        if not model:
            raise ValueError("model 必填")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.tools = tools or []
        self.timeout = timeout

    def decide(self, task: str, history: list[StepObservation]) -> Decision:
        messages = self._to_messages(task, history)
        payload: dict[str, Any] = {"model": self.model, "messages": messages}
        if self.tools:
            payload["tools"] = [{"type": "function", "function": t} for t in self.tools]
        data = self._post("/chat/completions", payload)
        choice = data["choices"][0]["message"]
        calls = choice.get("tool_calls") or []
        if calls:
            call = calls[0]
            fname = call["function"]["name"]
            raw_args = call["function"].get("arguments") or "{}"
            try:
                args = json.loads(raw_args)
            except json.JSONDecodeError:
                args = {}
            return Decision(tool_call=ToolCall(name=fname, args=args))
        content = choice.get("content") or ""
        return Decision(final=content.strip())

    def _to_messages(self, task: str, history: list[StepObservation]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [{"role": "user", "content": task}]
        for obs in history:
            messages.append(
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {"id": f"call_{obs.result.name}", "type": "function", "function": {
                            "name": obs.call.name,
                            "arguments": json.dumps(obs.call.args, ensure_ascii=False),
                        }}
                    ],
                }
            )
            messages.append({"role": "tool", "tool_call_id": f"call_{obs.result.name}", "content": obs.result.output})
        return messages

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())