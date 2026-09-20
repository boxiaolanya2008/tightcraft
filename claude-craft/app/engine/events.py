"""流式事件模型：HTTP 网关与引擎之间的传输协议。

后端把每步动作编码为 SSE 事件({type,payload})，前端据此渲染
用户气泡、助手流式文本、工具块(Bash/Read/Edit)与运行 eof。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SSE:
    """一条 SSE 事件。type 为事件名，payload 为 JSON 可序列化对。"""

    type: str
    payload: dict[str, Any] = field(default_factory=dict)

    def frame(self) -> bytes:
        import json

        body = json.dumps(self.payload, ensure_ascii=False)
        return f"event: {self.type}\ndata: {body}\n\n".encode("utf-8")


# ---- 事件名常量(前端契约) ----
class Ev:
    THREAD_NEW = "thread_new"
    TEXT_DELTA = "text_delta"        # 助手流式文本增量
    TOOL_START = "tool_start"        # 工具开始(渲染工具块 header)
    TOOL_END = "tool_end"            # 工具结束(带输出/错误)
    DONE = "done"                    # 一轮运行收敛
    ERROR = "error"                  # 运行失败(护栏/引擎异常)


def text_delta(token: str) -> SSE:
    return SSE(Ev.TEXT_DELTA, {"text": token})


def tool_start(name: str, tool: str, args: Any) -> SSE:
    return SSE(Ev.TOOL_START, {"id": name, "tool": tool, "args": args})


def tool_end(name: str, ok: bool, output: str = "", error: str = "") -> SSE:
    return SSE(Ev.TOOL_END, {"id": name, "ok": ok, "output": output, "error": error})


def done(final: str) -> SSE:
    return SSE(Ev.DONE, {"final": final})


def error(message: str) -> SSE:
    return SSE(Ev.ERROR, {"message": message})
