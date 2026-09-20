/**
 * provider.ts —— 自研离线 Mock 决策引擎，无需任何 API Key。
 *
 * 按「烛命·工具调用」格式产出一段脚本化决策序列(先读后写，结尾落出总结)，
 * 由 loop 层逐条消费并流式产出 SSE 事件。normal 模式不产出写动作，
 * accept 模式才尝试写入(仍会被 loop 的「写前读」守卫二次校验)。
 */

export type Mode = "normal" | "accept";

export interface ToolDecision {
  type: "tool";
  tool: string;
  args: Record<string, unknown>;
  reason: string;
}

export interface TextDecision {
  type: "text";
  text: string;
}

export interface DoneDecision {
  type: "done";
  finalText: string;
}

export type Decision = ToolDecision | TextDecision | DoneDecision;

const PROBE_WRITE_PATH = "server/.runtime/probe.md";

export class MockProvider {
  private steps: Decision[];
  private index = 0;

  constructor(
    readonly mode: Mode,
    readonly task: string,
  ) {
    const open =
      "烛龙一视：我将先行睁目照察工作区，依次列目录、读起点文档，再据所见推进。";
    const t1 =
      "读取先行：我已照见根系文档，需再列 docs 目录，确认说明材料，方敢于混沌中立序。";
    this.steps = [
      { type: "tool", tool: "fs_list", args: { path: "." }, reason: "先看清工作区全景" },
      { type: "text", text: open },
      { type: "tool", tool: "fs_read", args: { path: "README.md" }, reason: "读取项目 README" },
      { type: "text", text: t1 },
      { type: "tool", tool: "fs_list", args: { path: "docs" }, reason: "列出 docs 目录" },
      { type: "tool", tool: "fs_read", args: { path: "docs/naming-system.md" }, reason: "读取命名体系" },
      ...this.writeStep(),
      { type: "done", finalText: this.summary() } as DoneDecision,
    ];
  }

  /** 依据模式产出写步骤：normal 仅给一句为何被界拦的说明。 */
  private writeStep(): Decision[] {
    if (this.mode === "accept") {
      return [
        {
          type: "text",
          text: "已确认目标归属工作区且先前已读/已见，模式为 accept，获准落地一次写入。",
        },
        {
          type: "tool",
          tool: "fs_write",
          args: {
            path: PROBE_WRITE_PATH,
            content: `# 烛龙写入探针\n任务: ${this.task}\n时间: ${new Date().toISOString()}\n`,
          },
          reason: "已读前提满足，于明知处落笔",
        },
      ];
    }
    return [
      {
        type: "text",
        text: "normal 模式：此刻的写动作被「章尾之界」拦下——模式未明确放行，故止步于此，不硬闯。",
      },
    ];
  }

  private summary(): string {
    const tail =
      this.mode === "accept"
        ? "我已依「写前读」落成一枚探针文件，改动可定位、可复核。"
        : "我未被放行写入，故仅睁目察验而未动工——已照见，未越界。";
    return (
      `烛龙一视完毕。\n` +
      `- 已照见:完成 fs_list 目录清点、fs_read 文档读取${this.mode === "accept" ? "，并依据已读放行一次 fs_write" : ""}。\n` +
      `- ${tail}\n` +
      `- 仍是暗昧:真正让代码运转的验证(SSE/build)留待运行时由人复核。\n` +
      `烛照之下，混沌已复归为可复核的经纬。`
    );
  }

  /** 取下一个决策；序列耗尽返回 null。 */
  next(): Decision | null {
    if (this.index >= this.steps.length) return null;
    return this.steps[this.index++];
  }
}