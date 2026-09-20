"""流式执行循环测试：SSE 事件序列、模式门禁、护栏。"""

from __future__ import annotations

import pytest

from agentcraft.providers import MockProvider, _tool_call
from agentcraft.types import Decision

from app import config
from app.engine.events import SSE
from app.engine.loop import AgentRunner, steps_reached_limit


def collect(runner: AgentRunner, task: str) -> list[SSE]:
    return list(runner.iter_run(task))


def test_stream_emits_tool_and_done(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    provider = MockProvider([
        _tool_call("fs_list", dir="."),
        _tool_call("fs_read", path="a.txt"),
        lambda _h: "读取完成",
    ])
    (tmp_path / "a.txt").write_text("hi", encoding="utf-8")
    runner = AgentRunner(provider=provider, mode=config.Mode.ACCEPT_EDITS)
    events = collect(runner, "读一下")

    kinds = [e.type for e in events]
    assert kinds.count("tool_start") == 2
    assert kinds.count("tool_end") == 2
    assert kinds[-1] == "done"
    assert runner.result.ok and runner.result.final == "读取完成"


def test_normal_mode_denies_write(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    provider = MockProvider([
        _tool_call("fs_write", path="x.txt", text="data", force=True),
        lambda _h: "done",
    ])
    runner = AgentRunner(provider=provider, mode=config.Mode.NORMAL)
    events = collect(runner, "写点东西")
    end = [e for e in events if e.type == "tool_end"][0]
    assert end.payload["ok"] is False  # 非 accept 拒绝写
    assert "禁止写" in end.payload["error"]


def test_accept_mode_allows_write(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    provider = MockProvider([
        _tool_call("fs_write", path="y.txt", text="v", force=True),
        lambda _h: "written",
    ])
    runner = AgentRunner(provider=provider, mode=config.Mode.ACCEPT_EDITS)
    events = collect(runner, "写")
    assert any(e.type == "done" for e in events)
    assert (tmp_path / "y.txt").exists()


def test_guardrail_stops_runaway(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    class Endless(MockProvider):
        def decide(self, _task, history):
            return _tool_call("fs_list", dir=".")

    runner = AgentRunner(provider=Endless(), max_steps=3)
    events = collect(runner, "死循环")
    assert events[-1].type == "done"
    assert steps_reached_limit(runner.result.final)
    assert runner.result.ok is False


def test_empty_task_errors(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    runner = AgentRunner(provider=MockProvider([]))
    events = list(runner.iter_run("   "))
    assert events[-1].type == "error"
    assert runner.result.ok is False


def test_steps_reached_limit_helper():
    assert steps_reached_limit("[护栏] 未在预算内收敛") is True
    assert steps_reached_limit("") is False
    assert steps_reached_limit("正常完成") is False
