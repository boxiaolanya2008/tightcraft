"""HTTP 网关端到端测试：真实服务器 + 真实 SSE 抓取。"""

from __future__ import annotations

import json
import threading
import urllib.request

import pytest

from agentcraft.providers import MockProvider, _tool_call

from app.access import AccessControl, default_policy
from app.engine.loop import AgentRunner
from app.httpd import _wire_server, start_server
from app.state import ThreadStore


def _scripted_runner_factory(mode: str, task_hint: str):
    provider = MockProvider([
        _tool_call("fs_list", dir="."),
        lambda _h: f"已浏览 {task_hint}",
    ])
    return AgentRunner(provider=provider, mode=mode)


@pytest.fixture()
def srv():
    account = dict(
        store=ThreadStore(),
        access=AccessControl(default_policy()),
        runner_factory=_scripted_runner_factory,
    )
    # start_server 用默认(离线)工厂;这里直接自建 Gateway 以便注入脚本化工厂
    from app.httpd import Gateway
    gw = Gateway(**account)
    server = gw.serve("127.0.0.1", 0)
    _wire_server(server, gw)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    yield f"http://127.0.0.1:{port}"
    server.shutdown()
    server.server_close()


def _post(base, path, body):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req).read().decode())


def test_health(srv):
    data = json.loads(urllib.request.urlopen(srv + "/api/health").read())
    assert data["ok"] is True


def test_thread_lifecycle_and_sse(srv):
    created = _post(srv, "/api/threads", {"task": "看下目录"})
    tid = created["id"]
    assert created["messages"][0]["role"] == "user"

    # 触发运行并读取 SSE 流
    req = urllib.request.Request(
        srv + f"/api/threads/{tid}/run",
        data=json.dumps({"task": "看下目录", "mode": "accept"}).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.headers.get("Content-Type", "").startswith("text/event-stream")
        body = resp.read().decode()

    assert "tool_start" in body
    assert "done" in body

    # 回读线程应含 assistant 消息
    snap = json.loads(urllib.request.urlopen(srv + f"/api/threads/{tid}").read())
    roles = [m["role"] for m in snap["messages"]]
    assert "assistant" in roles


def test_list_and_delete_threads(srv):
    created = _post(srv, "/api/threads", {"task": "任务 A"})
    listing = json.loads(urllib.request.urlopen(srv + "/api/threads").read())
    assert any(t["id"] == created["id"] for t in listing["threads"])
    req = urllib.request.Request(srv + f"/api/threads/{created['id']}", method="DELETE")
    assert json.loads(urllib.request.urlopen(req).read())["deleted"] is True
