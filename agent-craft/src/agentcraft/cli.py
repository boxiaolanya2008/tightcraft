"""CLI：离线(演示/测试)与在线(OpenAI 兼容)两种驱动 Agent。

用法:
  agent-craft run "<task>"                # 离线 Mock 演示脚本
  agent-craft chat --api-key K --model M  # 走 OpenAI 兼容端点
"""

from __future__ import annotations

import argparse

from agentcraft.agent import Agent
from agentcraft.providers import MockProvider, OpenAIProvider, _tool_call


def _demo() -> str:
    """离线确定性演示:读 -> 变换 -> 写 -> 收尾，验证多步工具循环。"""
    steps = [
        _tool_call("fs_write", path="demo_out.txt", text="hello world\n", force=True),
        _tool_call("fs_read", path="demo_out.txt"),
        lambda _h: "已写入并读回 demo_out.txt，演示完成。",
    ]
    return steps


def cmd_run(args: argparse.Namespace) -> int:
    mock = MockProvider(_demo())
    agent = Agent(provider=mock, max_steps=8)
    print(agent.execute(args.task))
    print(f"[stat] 工具步骤: {len(agent.history)} "
          f"成功 {sum(1 for h in agent.history if h.result.ok)} / "
          f"失败 {sum(1 for h in agent.history if not h.result.ok)}")
    return 0


def cmd_chat(args: argparse.Namespace) -> int:
    if not args.api_key:
        print("chat 需要 --api-key 与 --model")
        return 2
    provider = OpenAIProvider(api_key=args.api_key, model=args.model, base_url=args.base_url)
    agent = Agent(provider=provider, max_steps=args.max_steps)
    print(agent.execute(args.task))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent-craft")
    sub = parser.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="离线 Mock 多步演示")
    r.add_argument("task")
    r.set_defaults(func=cmd_run)

    c = sub.add_parser("chat", help="走 OpenAI 兼容端点")
    c.add_argument("task")
    c.add_argument("--api-key", required=True)
    c.add_argument("--model", required=True)
    c.add_argument("--base-url", default="https://api.openai.com/v1")
    c.add_argument("--max-steps", type=int, default=8)
    c.set_defaults(func=cmd_chat)

    ns = parser.parse_args(argv)
    return ns.func(ns)


if __name__ == "__main__":
    raise SystemExit(main())