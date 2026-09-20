"""全链路流程管控测试：合法转移、非法拒绝、审计轨迹。"""

from __future__ import annotations

import pytest

from app.engine.pipeline import IllegalTransition, Stage, Workflow, run_pipeline


def test_full_chain_valid():
    wf = Workflow()
    for stage in (Stage.VALIDATE, Stage.PLAN, Stage.EXECUTE, Stage.REVIEW, Stage.FINISH):
        wf.transition(stage)
    assert wf.stage == Stage.FINISH
    assert len(wf.audit) == 5


def test_illegal_skip_rejected():
    wf = Workflow()
    with pytest.raises(IllegalTransition):
        wf.transition(Stage.EXECUTE)  # 从 IDLE 直接 EXECUTE 非法


def test_legal_returns_true():
    wf = Workflow()
    assert wf.try_move(Stage.VALIDATE) is True


def test_finish_is_terminal():
    wf = Workflow()
    for s in (Stage.VALIDATE, Stage.PLAN, Stage.EXECUTE, Stage.REVIEW, Stage.FINISH):
        wf.transition(s)
    assert wf.try_move(Stage.VALIDATE) is False  # 终态不可再转


def test_audit_trail_records_notes():
    wf = Workflow()
    wf.transition(Stage.VALIDATE, "入参校验")
    assert wf.audit[-1].note == "入参校验"
    assert wf.audit[-1].stage_to == Stage.VALIDATE


def test_run_pipeline_executes_stage_callbacks():
    calls = []

    class Steps:
        def validate(self):
            calls.append("validate")

        def execute(self):
            calls.append("execute")

        def finish(self):
            calls.append("finish")

    wf = run_pipeline(Steps())
    assert calls == ["validate", "execute", "finish"]
    assert wf.stage == Stage.FINISH
