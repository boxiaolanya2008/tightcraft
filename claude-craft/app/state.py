"""会话(线程)内存存储。进程内即可,零外部依赖。

gateway 层持有本对象;所有读写经 AccessControl 校验(仅 GATEWAY 角色)。
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field


@dataclass
class Message:
    role: str            # user | assistant | tool
    content: str = ""
    tool: str = ""       # 工具名(Bash/Read/Edit 等)
    ok: bool | None = None
    created: float = field(default_factory=time.time)


@dataclass
class Thread:
    id: str
    title: str
    created: float = field(default_factory=time.time)
    messages: list[Message] = field(default_factory=list)


class ThreadStore:
    def __init__(self, limit: int = 1000) -> None:
        self._threads: dict[str, Thread] = {}
        self._limit = limit

    def create(self, title: str) -> Thread:
        t = Thread(id=uuid.uuid4().hex[:8], title=title)
        self._threads[t.id] = t
        if len(self._threads) > self._limit:  # 简单容量护栏
            drop = next(iter(self._threads))
            del self._threads[drop]
        return t

    def get(self, tid: str) -> Thread | None:
        return self._threads.get(tid)

    def list(self) -> list[Thread]:
        return sorted(self._threads.values(), key=lambda t: t.created, reverse=True)

    def delete(self, tid: str) -> bool:
        return self._threads.pop(tid, None) is not None

    def append(self, tid: str, msg: Message) -> Message:
        t = self._threads.get(tid)
        if t is None:
            raise KeyError(tid)
        t.messages.append(msg)
        return msg

    def to_snapshot(self, thread: Thread) -> dict:
        return {
            "id": thread.id,
            "title": thread.title,
            "created": thread.created,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "tool": m.tool,
                    "ok": m.ok,
                    "created": m.created,
                }
                for m in thread.messages
            ],
        }
