/**
 * provider.ts —— 可插拔 Provider 工厂 + 离线/在线双实现。
 *
 * - MockProvider(离线)：无需 API Key，按「烛命」脚本产出决策序列，供演示与离线验证。
 * - OpenAIProvider(在线)：调任何 OpenAI 兼容 chat/completions 接口产出 Decision。
 * - createProvider(mode, task, config)：有 ZL_API_KEY 且 ZL_MODEL 时返回在线 Provider，否则 Mock。
 */

import type { Decision, Mode } from "./types";
import { plan, type PlanResult } from "./planner";
import { readPrompts } from "../prompts";

/** Provider 需满足的统一契约。 */
export interface Provider {
  readonly name: string;
  readonly mode: Mode;
  /** 是否支持 planning(决定 loop 是否产出 plan 事件)。 */
  readonly supportsPlanning: boolean;
  /** 取下一个决策；序列耗尽或已终止返回 null。 */
  next(): Decision | null | Promise<Decision | null>;
  /** 用 planner 生成计划。 */
  makePlan(task: string): PlanResult;
}

// ---------------------------------------------------------------------------
// 离线 Mock Provider
// ---------------------------------------------------------------------------

/** 写入探针的相对路径(相对 tools 的 baseDir)。 */
export const PROBE_WRITE_PATH = ".runtime/probe.md";

/** 单条决策(供内部使用)。 */
type DecisionScript = Decision & { kind?: string };

export class MockProvider implements Provider {
  readonly name = "mock";
  readonly supportsPlanning = true;
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
      { type: "done", finalText: this.summary() } as DecisionScript,
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
      `- 仍是暗昧:真正让代码运转的验证(构建/TUI 渲染)留待运行时由人复核。\n` +
      `烛照之下，混沌已复归为可复核的经纬。`
    );
  }

  next(): Decision | null {
    if (this.index >= this.steps.length) return null;
    return this.steps[this.index++];
  }

  makePlan(task: string): PlanResult {
    return plan(task);
  }
}

// ---------------------------------------------------------------------------
// 在线 OpenAI 兼容 Provider
// ---------------------------------------------------------------------------

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  /** 形如 https://api.openai.com/v1。 */
  baseURL?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = "https://api.openai.com/v1";

/** 自研工具 → OpenAI function 工具定义。 */
const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "fs_list",
      description: "列出指定目录下的条目。",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "目录路径，默认 '.'" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fs_read",
      description: "读取文件内容。",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fs_write",
      description: "写入文件内容。",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
];

type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: null; tool_calls: unknown[] };

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  readonly supportsPlanning = true;
  private readonly messages: ChatMessage[];
  private finished = false;

  constructor(
    readonly mode: Mode,
    readonly task: string,
    private readonly cfg: OpenAIConfig,
  ) {
    this.messages = [
      { role: "system", content: readPrompts().maestro },
      { role: "user", content: task },
    ];
  }

  /** 每次调用一次 chat/completions；有工具调用返回 ToolDecision，否则收尾为 DoneDecision。 */
  async next(): Promise<Decision | null> {
    if (this.finished) return null;
    const base = (this.cfg.baseURL ?? DEFAULT_BASE).replace(/\/+$/, "");
    const url = `${base}/chat/completions`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 60_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: this.messages,
          tools: TOOL_SCHEMAS,
          tool_choice: "auto",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        this.finished = true;
        return { type: "done", finalText: `在线 Provider 请求失败: HTTP ${res.status} ${text.slice(0, 200)}` };
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: ChatMessage & { tool_calls?: unknown[] }; finish_reason?: string }>;
      };
      const choice = json.choices?.[0];
      const msg = choice?.message;
      const content = typeof msg?.content === "string" ? msg.content.trim() : "";

      // 优先处理工具调用。
      if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        this.messages.push({
          role: "assistant",
          content: null,
          tool_calls: msg.tool_calls,
        });
        const tc = msg.tool_calls[0] as { function?: { name?: string; arguments?: string } };
        const tool = tc?.function?.name ?? "";
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc?.function?.arguments ?? "{}");
        } catch {
          args = {};
        }
        return { type: "tool", tool, args, reason: `openai 请求调用工具「${tool}」` };
      }

      if (content) {
        this.messages.push({ role: "assistant", content });
      }
      const finish = choice?.finish_reason;
      if (finish === "stop" || finish === "length" || (finish && !msg?.tool_calls)) {
        this.finished = true;
      }
      if (content) {
        return { type: "text", text: content + "\n" };
      }
      this.finished = true;
      return {
        type: "done",
        finalText: content || `在线 Provider 已结束(无更多决策，模型 ${this.cfg.model})`,
      };
    } catch (err) {
      this.finished = true;
      return { type: "done", finalText: `在线 Provider 出错: ${(err as Error).message}` };
    } finally {
      clearTimeout(timer);
    }
  }

  makePlan(task: string): PlanResult {
    return plan(task);
  }
}

// ---------------------------------------------------------------------------
// 工厂
// ---------------------------------------------------------------------------

export interface CreateProviderOptions {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  timeoutMs?: number;
}

/**
 * createProvider 工厂：有 ZL_API_KEY 且 ZL_MODEL 时返回在线 Provider，否则 Mock。
 * 环境变量：ZL_API_KEY / ZL_BASE_URL / ZL_MODEL。默认 base https://api.openai.com/v1。
 */
export function createProvider(
  mode: Mode,
  task: string,
  options: CreateProviderOptions = {},
): Provider {
  const apiKey = options.apiKey ?? process.env.ZL_API_KEY;
  const model = options.model ?? process.env.ZL_MODEL ?? "";
  if (apiKey && model) {
    return new OpenAIProvider(mode, task, {
      apiKey,
      model,
      baseURL: options.baseURL ?? process.env.ZL_BASE_URL ?? DEFAULT_BASE,
      timeoutMs: options.timeoutMs,
    });
  }
  return new MockProvider(mode, task);
}