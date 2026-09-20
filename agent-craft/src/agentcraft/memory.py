"""指纹记忆：会话内文件内容锁存 + 指纹失效，控制上下文翻烧。

路径 -> (指纹, 摘要)。指纹未变即复用，变了才重读。
FileWriteTool 的"写前已读"门禁也复用同一张指纹表。
"""

from __future__ import annotations

from pathlib import Path

from agentcraft.tools import fingerprint


class Memory:
    """会话内锁存表(不随 Arena 展示)。"""

    def __init__(self) -> None:
        self._latch: dict[str, tuple[str, str]] = {}  # path -> (fingerprint, summary)
        self._fingerprints: dict[str, str] = {}  # 活引用，供写门禁读取

    def reads(self) -> dict[str, str]:
        """返回活指纹表(同一对象)；写门禁实时可见新锁存。"""
        return self._fingerprints

    def recall(self, path: str) -> str | None:
        """匹配指纹则返回摘要，未读或已失效则返回 None。"""
        fp, summary = self._latch.get(path, (None, ""))
        if fp is None:
            return None
        return summary if fp == fingerprint(path) else None

    def latch(self, path: str, summary: str) -> str:
        """读取并锁存；返回当前指纹，同步到活指纹表。"""
        fp = fingerprint(path)
        self._latch[path] = (fp, summary)
        self._fingerprints[path] = fp
        return fp

    def invalidate(self, path: str) -> None:
        self._latch.pop(path, None)
        self._fingerprints.pop(path, None)

    def is_valid(self, path: str) -> bool:
        fp = self._latch.get(path, (None, ""))[0]
        return fp is not None and fp == fingerprint(path)

    def stats(self) -> dict[str, int]:
        return {"latched": len(self._latch), "valid": sum(1 for p in self._latch if self.is_valid(p))}


def summarize_file(path: str | Path, limit: int = 400) -> str:
    """取文件头作摘要，控制记忆占用。"""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(p)
    text = p.read_text(encoding="utf-8", errors="replace")
    return text[:limit] + ("…" if len(text) > limit else "")