/**
 * loop.ts —— 流式执行循环：驱动 pipeline 阶段推进，逐条消费 provider 决策，
 * 在每个工具调用前过 access.guard，并强制「写前读 + accept 模式」才能 fs_write。
 * 在 VALIDATE 之后、EXECUTE 之前，若 provider 支持 planning 则产出 plan 事件。
 * 产生的全部进度以类型化事件(yield)推出，由 CLI/TUI 消费渲染。
 */

import * as path from "node:path";
import { AccessDenied, guard as accessGuard } from "./access";
import type { Provider } from "./provider";
import { orderedTitles } from "./planner";
import { Pipeline } from "./pipeline";
import { ToolRegistry } from "./tools";
import type { Mode, RunEvent, ToolRecord, Decision } from "./types";

export interface RunParams {
  task: string;
  mode: Mode;
  role: "core";
  provider: Provider;
  tools: ToolRegistry;
}

/**
 * 流式执行循环(异步生成器)。调用方(for await)逐帧消费，
 * 把工具块/文本增量/计划/错误/汇总即时推给渲染层。
 */
export async function* runLoop(params: RunParams): AsyncGenerator<RunEvent> {
  const { provider, tools, mode, role, task } = params;
  const pipe = new Pipeline();
  const seen = new Set<string>(); // 已被读/被列出过的绝对路径
  const records: ToolRecord[] = [];
  let finalText = `任务:「${task.slice(0, 60)}」\n`;

  // 阶段一：VALIDATE
  pipe.transition("VALIDATE");
  yield { type: "text_delta", payload: { text: "进入 VALIDATE：检查输入与角色边界。\n" } };

  // 阶段二：PLAN(在此产出 plan 事件，位于 EXECUTE 之前)
  pipe.transition("PLAN");
  if (provider.supportsPlanning) {
    const result = provider.makePlan(task);
    yield {
      type: "plan",
      payload: { orderedSteps: orderedTitles(result), cyclic: result.cyclic },
    };
  }
  yield { type: "text_delta", payload: { text: "进入 PLAN：以烛照断因果，规划先读后写。\n" } };

  // 阶段三：EXECUTE
  pipe.transition("EXECUTE");

  let decision: Decision | null = await provider.next();
  while (decision) {
    if (decision.type === "text") {
      yield { type: "text_delta", payload: { text: decision.text + "\n" } };
    } else if (decision.type === "done") {
      finalText = decision.finalText;
      break;
    } else if (decision.type === "tool") {
      const { tool, args } = decision;
      const id = cryptoToken();

      // 1) 权限守卫：每个工具调用前必过 guard(role, capability)
      const capability = tools.capabilityOf(tool);
      if (!capability) {
        yield* rejectTool(id, tool, args, records, `未知工具「${tool}」`);
        decision = await provider.next();
        continue;
      }
      try {
        accessGuard(role, capability);
      } catch (e) {
        if (e instanceof AccessDenied) {
          yield* rejectTool(id, tool, args, records, e.message);
          decision = await provider.next();
          continue;
        }
        throw e;
      }

      // 2) 写前读 + accept 模式强制校验
      if (tool === "fs_write") {
        const wtarget = String(args.path ?? "");
        if (mode !== "accept") {
          yield* rejectTool(
            id,
            tool,
            args,
            records,
            "normal 模式拒绝写入：模式未明确放行，止步于章尾之界。",
          );
          decision = await provider.next();
          continue;
        }
        if (!wasSeen(tools.baseDir, wtarget, seen)) {
          yield* rejectTool(
            id,
            tool,
            args,
            records,
            `写前读未满足：目标「${wtarget}」未被先读/先列，拒绝写入。`,
          );
          decision = await provider.next();
          continue;
        }
      }

      // 3) 放行执行
      yield { type: "tool_start", payload: { id, tool, args } };
      const result = await tools.run(tool, args);
      if (result.ok) {
        markSeen(tools.baseDir, tool, args, result, seen);
        yield {
          type: "tool_end",
          payload: {
            id,
            tool,
            ok: true,
            result: compactJson(result.data),
          },
        };
        records.push({ tool, status: "ok", args, note: compactJson(result.data), at: Date.now() });
      } else {
        yield {
          type: "tool_end",
          payload: { id, tool, ok: false, error: result.error },
        };
        records.push({ tool, status: "error", args, note: result.error, at: Date.now() });
      }
    }
    decision = await provider.next();
  }

  // 阶段四：REVIEW
  pipe.transition("REVIEW");
  yield { type: "text_delta", payload: { text: "进入 REVIEW：烛龙闭目复盘已照见之事。\n" } };

  // 阶段五：FINISH
  pipe.transition("FINISH");
  yield {
    type: "done",
    payload: { finalText, tools: records },
  };
}

/** 拒绝一个工具调用：推 error + tool_start + tool_end(失败) + 登记记录。 */
function* rejectTool(
  id: string,
  tool: string,
  args: Record<string, unknown>,
  records: ToolRecord[],
  msg: string,
): Generator<RunEvent> {
  yield { type: "error", payload: { message: msg } };
  yield { type: "tool_start", payload: { id, tool, args } };
  yield { type: "tool_end", payload: { id, tool, ok: false, error: msg } };
  records.push({ tool, status: "error", args, note: msg, at: Date.now() });
}

/** 是否目标或其任一祖先目录已被读/被列过(写前读判定)。 */
function wasSeen(baseDir: string, target: string, seen: Set<string>): boolean {
  const abs = path.resolve(baseDir, target);
  let cur = abs;
  for (;;) {
    if (seen.has(cur)) return true;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return false;
}

/** 依据工具执行结果，把「已读/已见」路径登记进 seen。 */
function markSeen(
  baseDir: string,
  tool: string,
  args: Record<string, unknown>,
  result: { ok: boolean; data?: unknown },
  seen: Set<string>,
): void {
  const abs = (p: unknown) => path.resolve(baseDir, String(p ?? "."));
  if (tool === "fs_list") {
    seen.add(abs(args.path));
    const data = result.data as { items?: Array<{ name: string }> } | undefined;
    for (const it of data?.items ?? []) {
      seen.add(path.resolve(abs(args.path), it.name));
    }
  } else if (tool === "fs_read" || tool === "fs_write") {
    seen.add(abs(args.path));
  }
}

function compactJson(data: unknown): string | undefined {
  if (data === undefined) return undefined;
  const s = typeof data === "string" ? data : JSON.stringify(data);
  return (s ?? "").slice(0, 180);
}

function cryptoToken(): string {
  return `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}