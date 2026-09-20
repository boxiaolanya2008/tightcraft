"""自研 HTTP 网关：线程服务器 + 路由 + SSE，全 stdlib，线程驱动。

分层结果都是自研体系的一部分：
- gateway 会话层：持有 ThreadStore + AccessControl + Runner 工厂
- Any 请求先过 access 校验(仅 GATEWAY 角色)
- /api/threads/{id}/run 返回 text/event-stream，逐事件推送
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable

from agentcraft.providers import MockProvider, OpenAIProvider, _tool_call
from agentcraft.types import Decision

from app import config
from app.access import AccessControl, default_policy
from app.engine.loop import AgentRunner
from app.state import Message, Thread, ThreadStore


class _Handlers:
    """路由表: METHOD path -> 处理(handler, store, access, runner_factory)。"""


class Gateway:
    """聚合网关:会话存储 + 权限 + 引擎运行。"""

    def __init__(
        self,
        store: ThreadStore | None = None,
        access: AccessControl | None = None,
        runner_factory: Callable[[], AgentRunner] | None = None,
    ) -> None:
        self.store = store or ThreadStore()
        self.access = access or AccessControl(default_policy())
        self.runner_factory = runner_factory or _default_runner_factory
        self.web_root = config.WEB_ROOT

    def serve(
        self,
        host: str = config.DEFAULT_HOST,
        port: int = config.DEFAULT_PORT,
    ) -> ThreadingHTTPServer:
        return ThreadingHTTPServer((host, port), _make_handler(self))


class _Http(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ---- 工具 ----
    def log_message(self, *a):  # 抑制默认日志噪音
        pass

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b"{}"
        return json.loads(body or b"{}")

    # ---- 路由入口 ----
    def do_GET(self):  # noqa: N802
        routes = {
            "/api/health": self._health,
        }
        if self.path in routes:
            self._guard("gateway.threads.read")
            routes[self.path]()
            return
        if self.path.startswith("/api/threads"):
            self._guard("gateway.threads.read")
            self._get_threads(self.path)
            return
        self._static()

    def do_POST(self):  # noqa: N802
        if self.path == "/api/threads":
            self._guard("gateway.threads.write")
            self._create_thread()
        elif self.path.startswith("/api/threads/") and self.path.endswith("/run"):
            self._guard("gateway.threads.write")
            self._run_thread()
        else:
            self._json(404, {"error": "not found"})

    def do_DELETE(self):  # noqa: N802
        self._guard("gateway.threads.write")
        self._delete_thread(self.path)

    # ---- 权限 ----
    def _guard(self, capability: str) -> None:
        gw: Gateway = self.server.gateway
        gw.access.guard("gateway", capability)

    # ---- handlers ----
    def _health(self) -> None:
        self._json(200, {"ok": True, "version": "0.1.0"})

    def _get_threads(self, path: str) -> None:
        gw = self.server.gateway
        parts = path.split("/")  # /api/threads[/{id}]
        if len(parts) >= 4 and parts[3]:
            t = gw.store.get(parts[3])
            self._json(200, gw.store.to_snapshot(t) if t else {"error": "not found"})
        else:
            self._json(200, {"threads": [gw.store.to_snapshot(t) for t in gw.store.list()]})

    def _create_thread(self) -> None:
        gw = self.server.gateway
        data = self._read_json()
        task = (data.get("task") or "新对话").strip() or "新对话"
        title = task[: config.THREAD_TITLE_LIMIT]
        t = gw.store.create(title)
        gw.store.append(t.id, Message(role="user", content=task))
        self._json(200, gw.store.to_snapshot(t))

    def _delete_thread(self, path: str) -> None:
        gw = self.server.gateway
        tid = path.split("/")[-1]
        self._json(200, {"deleted": gw.store.delete(tid)})

    def _run_thread(self) -> None:
        gw = self.server.gateway
        tid = self.path.split("/")[3]
        thread = gw.store.get(tid)
        if thread is None:
            self._json(404, {"error": "thread not found"})
            return
        data = self._read_json()
        task = (data.get("task") or "").strip()
        mode = data.get("mode", config.Mode.NORMAL)

        runner = gw.runner_factory(mode=mode, task_hint=task)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        assistant_content: list[str] = []
        for sse in runner.iter_run(task):
            try:
                self.wfile.write(sse.frame())
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                self.server.gateway_log("client disconnected")
                break
            if sse.type == "text_delta":
                assistant_content.append(sse.payload.get("text", ""))
        partial = "".join(assistant_content)
        gw.store.append(
            thread.id,
            Message(role="assistant", content=partial, ok=runner.result.ok),
        )
        if runner.result.message:
            gw.store.append(
                thread.id,
                Message(role="assistant", content=runner.result.message, ok=False),
            )
        self.close_connection = True  # SSE 无定长:写毕即断,客户端读到 EOF 结束

    # ---- 静态前端 ----
    def _static(self) -> None:
        gw = self.server.gateway
        rel = self.path.lstrip("/") or "index.html"
        target = (gw.web_root / rel).resolve()
        if not (target == gw.web_root or gw.web_root in target.parents):
            self._json(403, {"error": "forbidden"})
            return
        if not target.is_file():
            self._json(404, {"error": "not found"})
            return
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
        }.get(target.suffix, "application/octet-stream")
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _make_handler(gw: Gateway):
    class Handler(_Http):  # 闭包注入网关
        pass

    return Handler


def _wire_server(server: ThreadingHTTPServer, gw: Gateway) -> None:
    server.gateway = gw
    server.gateway_log = lambda msg: print(f"[gateway] {msg}")


# ---- 默认 Runner 工厂(离线 Mock 演示) ----
def _demo_decisions(task: str) -> list:
    return [
        _tool_call("fs_list", dir="."),
        lambda _h: Decision(final=f"已浏览目录，任务「{task}」的离线演示完成。"),
    ]


def _default_runner_factory(mode: str, task_hint: str):
    provider = MockProvider(_demo_decisions(task_hint))
    return AgentRunner(provider=provider, mode=mode)


def openai_runner_factory(api_key: str, model: str, base_url: str):
    """用 OpenAI 兼容端点构建 Runner 工厂(在线真实运行)。"""

    def factory(mode: str, task_hint: str):
        from app.engine.loop import AgentRunner

        provider = OpenAIProvider(api_key=api_key, model=model, base_url=base_url)
        return AgentRunner(provider=provider, mode=mode)

    return factory


def start_server(
    token: str | None = None,
    api_key: str = "",
    model: str = "",
    base_url: str = "https://api.openai.com/v1",
    host: str = config.DEFAULT_HOST,
    port: int = config.DEFAULT_PORT,
    token_auth: str | None = None,
) -> ThreadingHTTPServer:
    """启动网关。传 api_key/model 用在线模式，否则离线 Mock。"""
    if api_key and model:
        gw = Gateway(runner_factory=openai_runner_factory(api_key, model, base_url))
    else:
        gw = Gateway()
    server = gw.serve(host, port)
    _wire_server(server, gw)
    return server
