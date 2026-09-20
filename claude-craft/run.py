"""claude-craft 启动入口。

用法:
    python3 run.py                     # 离线 Mock 演示
    python3 run.py --api-key K --model gpt-4o-mini [--base-url ...]
    python3 run.py --port 8731
"""

from __future__ import annotations

import argparse

from app.engine import _bootstrap  # noqa: F401  确保自研引擎可导入
from app import config
from app.httpd import start_server


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="claude-craft")
    parser.add_argument("--host", default=config.DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=config.DEFAULT_PORT)
    parser.add_argument("--api-key", default="")
    parser.add_argument("--model", default="")
    parser.add_argument("--base-url", default="https://api.openai.com/v1")
    args = parser.parse_args(argv)

    server = start_server(
        api_key=args.api_key,
        model=args.model,
        base_url=args.base_url,
        host=args.host,
        port=args.port,
    )
    mode = "在线(OpenAI 兼容)" if (args.api_key and args.model) else "离线 Mock"
    print(f"[claude-craft] 引擎: {mode}")
    print(f"[claude-craft] 打开 http://{args.host}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[claude-craft] 已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
