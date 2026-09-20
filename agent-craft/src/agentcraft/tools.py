"""工具系统：抽象 + 注册表 + 内置文件/目录工具。

自研差异点：FileWriteTool 内置"写前已读"门禁——对已存在文件写入前必须持有该文件
的当前指纹（先读后写），否则拒绝。与工具箱 "写前已读 / 写后已校" 原则一致，
从机制上防覆盖未读文件。
"""

from __future__ import annotations

import hashlib
import os
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Callable


def fingerprint(path: str | os.PathLike) -> str:
    """内容签名；不存在或不可读则返回空串。"""
    p = Path(path)
    try:
        return hashlib.sha256(p.read_bytes()).hexdigest()[:16]
    except OSError:
        return ""


def weak_fingerprint(path: str | os.PathLike) -> str:
    """兜底指纹：mtime+长度，写入后变化即失效。"""
    try:
        st = Path(path).stat()
        return f"{st.st_mtime_ns}:{st.st_size}"
    except OSError:
        return ""


class Tool(ABC):
    """工具接口。"""

    name: str = ""
    description: str = ""
    params: dict[str, Any] = {}

    @abstractmethod
    def run(self, args: dict[str, Any]) -> str:
        """执行并返回给模型的可观测文本。异常应向上抛。"""
        raise NotImplementedError


def _require(args: dict[str, Any], key: str, path_field: bool = False) -> str:
    if key not in args or args[key] in (None, ""):
        raise ValueError(f"缺少必填参数 `{key}`")
    return str(args[key])


class FileReadTool(Tool):
    name = "fs_read"
    description = "读取文本文件内容。"
    params = {"type": "object", "properties": {"path": {"type": "string"}, "limit": {"type": "number"}}}

    def __init__(self, tracker: dict[str, str] | None = None, root: str = ".") -> None:
        self.tracker = tracker
        self.root = Path(root).resolve()

    def run(self, args: dict[str, Any]) -> str:
        raw = _require(args, "path")
        p = Path(raw)  # 读取允许读任意路径(读是安全操作)
        if not p.is_file():
            raise FileNotFoundError(p)
        limit = int(args.get("limit") or 0)
        data = p.read_text(encoding="utf-8", errors="replace")
        if limit and len(data) > limit:
            data = data[:limit] + f"\n…(截断, 共{len(data)}字符)"
        if self.tracker is not None:
            key = str((self.root / raw).resolve())
            self.tracker[key] = fingerprint(key)
        return data


class FileListTool(Tool):
    name = "fs_list"
    description = "列出目录下的直接子项。"
    params = {"type": "object", "properties": {"dir": {"type": "string"}}}

    def run(self, args: dict[str, Any]) -> str:
        d = Path(_require(args, "dir"))
        if not d.is_dir():
            raise NotADirectoryError(d)
        entries = sorted(p.name + ("/" if p.is_dir() else "") for p in d.iterdir())
        return "\n".join(entries) if entries else "(空目录)"


class FileWriteTool(Tool):
    """写文件。已有文件须先读(持有当前指纹)；设 force=True 可强制覆盖。"""

    name = "fs_write"
    description = "写文本文件。已存在文件必须先 fs_read，否则拒绝；结构变更不可强改未读文件。"
    params = {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "text": {"type": "string"},
            "force": {"type": "boolean"},
        },
        "required": ["path", "text"],
    }

    def __init__(self, memory: dict[str, str] | None = None, root: str = ".") -> None:
        self.memory = memory  # path -> 上次读取指纹
        self.root = Path(root).resolve()

    def run(self, args: dict[str, Any]) -> str:
        path = _require(args, "path")
        text = _require(args, "text")
        p = self._resolve(path)
        if p.is_file() and not bool(args.get("force")):
            self._assert_read_before_write(p)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        fp = fingerprint(p)
        if self.memory is not None:
            self.memory[str(p)] = fp
        return f"已写入 {p} (指纹 {fp})"

    def _resolve(self, raw: str) -> Path:
        p = (self.root / raw).resolve()
        if not (p == self.root or self.root in p.parents):
            raise PermissionError(f"越界路径被拒绝: {raw}")
        return p

    def _assert_read_before_write(self, p: Path) -> None:
        current = fingerprint(p)
        seen = self.memory.get(str(p)) if self.memory else None
        if not seen or seen != current:
            raise PermissionError(
                f"写保护: 文件 {p} 未先 fs_read(已读指纹 {seen!r} vs 当前 {current!r})。"
                "请先 fs_read 再写;或显式 force=true 覆盖未审计文件。"
            )


class ShellTool(Tool):
    """受限 shell:仅执行白名单命令，拒绝管道/重定向/多命令连接符。"""

    name = "sh_run"
    description = "运行白名单内只读命令。"
    params = {"type": "object", "properties": {"command": {"type": "string"}}}

    _UNSAFE = set("|;&<>`$()")
    _ALLOW = {"ls", "pwd", "cat", "git", "whoami", "echo"}

    def run(self, args: dict[str, Any]) -> str:
        import subprocess

        cmd = _require(args, "command").strip()
        parts = cmd.split()
        if not parts or parts[0] not in self._ALLOW:
            raise PermissionError(f"命令不在白名单: {cmd}")
        if any(ch in cmd for ch in self._UNSAFE):
            raise PermissionError(f"含不安全字符(出现 `|;&<>$()` 之一): {cmd}")
        try:
            proc = subprocess.run(parts, capture_output=True, text=True, timeout=30, check=False)
        except subprocess.TimeoutExpired:
            return "超时(30s)"
        return proc.stdout.rstrip() or (f"(stderr) {proc.stderr.rstrip()}" if proc.stderr else "(空输出)")


class _FnTool(Tool):
    """把裸函数包成 Tool(用于自定义无 schema 的注册)。"""

    def __init__(self, name: str, fn: Callable[[dict[str, Any]], str]) -> None:
        self.name = name
        self._fn = fn
        self.description = f"自定义工具 {name}"
        self.params = {"type": "object", "properties": {}}

    def run(self, args: dict[str, Any]) -> str:
        return self._fn(args)


class Registry:
    """工具注册表。"""

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def register_fn(self, name: str, fn: Callable[[dict[str, Any]], str]) -> None:
        self._tools[name] = _FnTool(name=name, fn=fn)

    def names(self) -> list[str]:
        return sorted(self._tools)

    def schema(self) -> list[dict[str, Any]]:
        """返回给 OpenAI 兼容 provider 的函数 schema。"""
        return [
            {"name": t.name, "description": t.description, "parameters": t.params}
            for t in self._tools.values()
        ]

    def run(self, name: str, args: dict[str, Any]) -> str:
        if name not in self._tools:
            raise KeyError(f"未知工具: {name}")
        return self._tools[name].run(args)


def build_registry(root: str = ".", memory: object | None = None) -> Registry:
    """组装内置工具：读/列目录/受限 shell + 带门禁的写。

    memory 为 Memory 实例；内部的 live 指纹表同时供 read 记录与 write 门禁，
    保证"先读后写"跨工具一致生效。
    """
    from agentcraft.memory import Memory

    tracker = memory.reads() if isinstance(memory, Memory) else (memory or {})
    reg = Registry()
    reg.register(FileReadTool(tracker=tracker, root=root))
    reg.register(FileListTool())
    reg.register(FileWriteTool(memory=tracker, root=root))
    reg.register(ShellTool())
    return reg