"""Agent 框架离线测试：全部不需网络，证明能实际跑通。"""

from __future__ import annotations

import os
import pathlib

import pytest

from agentcraft.agent import Agent
from agentcraft.memory import Memory, fingerprint
from agentcraft.planning import DAGError, decompose, execute_plan
from agentcraft.providers import MockProvider, _tool_call
from agentcraft.tools import build_registry
from agentcraft.types import Plan, Step

TMP = pathlib.Path("_t") / "tt"


@pytest.fixture()
def cwd_tmp(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    return tmp_path


# ---- 端到端:多步工具循环实际生效 ----

def test_agent_executes_multi_step_loop(cwd_tmp):
    steps = [
        _tool_call("fs_write", path="a.txt", text="alpha\n", force=True),
        _tool_call("fs_read", path="a.txt"),
        lambda _h: "OK:文件已写读一致",
    ]
    agent = Agent(provider=MockProvider(steps), max_steps=8)
    out = agent.execute("写读文件")
    assert out == "OK:文件已写读一致"
    assert len(agent.history) == 2
    assert all(h.result.ok for h in agent.history)


def test_agent_llmless_plans_and_runs_tools(cwd_tmp):
    # provider 根据 history 动态决策:读清单 -> 读文件 -> 收敛
    def decide(history):
        if not history:
            return _tool_call("fs_list", dir=".")
        if history[-1].result.name == "fs_list":
            return _tool_call("fs_read", path="b.txt")
        return "已读 b.txt"

    (cwd_tmp / "b.txt").write_text("bbb", encoding="utf-8")
    agent = Agent(provider=MockProvider([decide]), max_steps=5)
    assert agent.execute("浏览并读") == "已读 b.txt"


def test_agent_guardrail_stops_runaway(cwd_tmp):
    class Endless(MockProvider):
        def decide(self, _task, history):
            return _tool_call("fs_list", dir=".")

    agent = Agent(provider=Endless(), max_steps=3)
    out = agent.execute("死循环")
    assert "护栏" in out
    assert len(agent.history) == 3


# ---- 规划:DAG 与拓扑序 ----

def test_plan_topological_order():
    plan = Plan(
        task="demo",
        steps=[Step("a", "A", []), Step("b", "B", ["a"]), Step("c", "C", ["b"])],
    )
    ids = [s.id for s in plan.order()]
    assert ids == ["a", "b", "c"]


def test_plan_cycle_raises():
    plan = Plan(task="x", steps=[Step("a", "A", ["b"]), Step("b", "B", ["a"])])
    with pytest.raises(DAGError):
        plan.order()


def test_plan_dangling_dep_raises():
    plan = Plan(task="x", steps=[Step("a", "A", ["nope"])])
    with pytest.raises(DAGError):
        plan.order()


def test_decompose_heuristic():
    p = decompose("任务")
    assert len(p.steps) == 3
    assert p.steps[0].id == "collect"


def test_execute_plan_sequence(cwd_tmp):
    order = []
    p = decompose("任务")
    execute_plan(p, lambda s: order.append(s.id))
    assert order[0] == "collect"  # 拓扑序:collect 先于 implement/verify


# ---- 记忆:指纹失效与锁存 ----

def test_memory_latch_reuse_and_invalidate(cwd_tmp):
    f = cwd_tmp / "m.txt"
    f.write_text("one", encoding="utf-8")
    m = Memory()
    m.latch(str(f), "one")
    assert m.recall(str(f)) == "one"          # 指纹未变 -> 复用
    f.write_text("two", encoding="utf-8")
    assert m.recall(str(f)) is None           # 内容变化 -> 失效
    m.latch(str(f), "two")
    assert m.is_valid(str(f))


def test_fingerprint_builtin():
    import tempfile

    with tempfile.NamedTemporaryFile("w", delete=False) as t:
        t.write("x")
        path = t.name
    assert fingerprint(path)
    os.unlink(path)
    assert fingerprint(path) == ""            # 不可读 -> 空串


# ---- 工具:写前已读门禁 ----

def test_write_requires_prior_read(cwd_tmp):
    f = cwd_tmp / "g.txt"
    f.write_text("orig", encoding="utf-8")
    reg = build_registry()
    with pytest.raises(PermissionError):
        reg.run("fs_write", {"path": str(f), "text": "改写未读文件"})


def test_write_allowed_after_read(cwd_tmp):
    f = cwd_tmp / "g2.txt"
    f.write_text("v1", encoding="utf-8")
    reg = build_registry()
    reg.run("fs_read", {"path": str(f)})
    reg.run("fs_write", {"path": str(f), "text": "v2 after read"})


def test_stale_read_rejects_write(cwd_tmp):
    f = cwd_tmp / "g3.txt"
    f.write_text("v1", encoding="utf-8")
    reg = build_registry()
    reg.run("fs_read", {"path": str(f)})      # 锁存指纹 v1
    f.write_text("v2 by another process", encoding="utf-8")  # 指纹变化
    with pytest.raises(PermissionError):      # 陈旧读，拒绝覆盖
        reg.run("fs_write", {"path": str(f), "text": "clobber"})


def test_workflow_end_to_end_gate(cwd_tmp):
    """一次完整可跑流程:读源 -> 写新文件(force) -> 校验指纹。"""
    src = cwd_tmp / "src.txt"
    src.write_text("source data", encoding="utf-8")
    steps = [
        _tool_call("fs_read", path="src.txt"),
        _tool_call("fs_write", path="out.txt", text="derived\n", force=True),
        lambda _h: "workflow done",
    ]
    agent = Agent(provider=MockProvider(steps), max_steps=5)
    assert agent.execute("读源并产出") == "workflow done"
    assert (cwd_tmp / "out.txt").read_text(encoding="utf-8") == "derived\n"