/**
 * cli/src/index.ts —— 烛龙·赤水 CLI。
 * 子命令：run / chat / prompts / plan。纯 Node + commander，逐帧消费 core 事件并打印。
 */

import { Command } from "commander";
import * as readline from "node:readline";
import * as path from "node:path";
import {
  createProvider,
  runLoop,
  ToolRegistry,
  plan,
  orderedTitles,
  readPrompts,
  type Mode,
  type RunEvent,
  type PlanResult,
} from "@zhulong/core";

/** 把工具参数压成 `key=value` 紧凑文本。 */
function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
}

/** 运行一次 loop 并逐帧打印，返回 done 汇总。 */
async function runAndPrint(task: string, mode: Mode, baseDir: string): Promise<void> {
  const provider = createProvider(mode, task);
  const tools = new ToolRegistry(baseDir);
  const pending = new Map<string, { tool: string; args: Record<string, unknown> }>();
  let okCount = 0;
  let errCount = 0;

  for await (const ev of runLoop({ task, mode, role: "core", provider, tools })) {
    renderEvent(ev, pending, (n) => (okCount += n), (n) => (errCount += n));
  }

  console.log(`\n[汇总] 工具: ${okCount} 成功 / ${errCount} 失败/被拒；审计轨迹见 core Pipeline。`);
}

/** 渲染单个事件到 stdout。 */
function renderEvent(
  ev: RunEvent,
  pending: Map<string, { tool: string; args: Record<string, unknown> }>,
  addOk: (n: number) => void,
  addErr: (n: number) => void,
): void {
  switch (ev.type) {
    case "plan":
      console.log(`[规划] ${ev.payload.orderedSteps.join(" → ") || "(空计划)"}`);
      break;
    case "text_delta":
      process.stdout.write(ev.payload.text.endsWith("\n") ? ev.payload.text : ev.payload.text + "\n");
      break;
    case "tool_start":
      pending.set(ev.payload.id, { tool: ev.payload.tool, args: ev.payload.args });
      console.log(`[●] ${ev.payload.tool} ${formatArgs(ev.payload.args)}`);
      break;
    case "tool_end": {
      const p = pending.get(ev.payload.id);
      const argsTxt = p ? ` ${formatArgs(p.args)}` : "";
      if (ev.payload.ok) {
        addOk(1);
        console.log(`  [✓] ${ev.payload.tool}${argsTxt}${ev.payload.result ? ` → ${ev.payload.result}` : ""}`);
      } else {
        addErr(1);
        console.log(`  [✗] ${ev.payload.tool}${argsTxt} ${ev.payload.error ?? "失败"}`);
      }
      pending.delete(ev.payload.id);
      break;
    }
    case "error":
      console.log(`[error] ${ev.payload.message}`);
      break;
    case "done": {
      console.log(`\n—— done ——`);
      console.log(ev.payload.finalText);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 子命令实现
// ---------------------------------------------------------------------------

async function runCmd(
  task: string,
  opts: { mode?: string; cwd?: string },
): Promise<void> {
  const mode: Mode = opts.mode === "accept" ? "accept" : "normal";
  const baseDir = path.resolve(opts.cwd ?? process.cwd());
  await runAndPrint(task, mode, baseDir);
}

async function planCmd(task: string): Promise<void> {
  const r: PlanResult = plan(task);
  const titles = orderedTitles(r);
  console.log(`任务: ${r.task}`);
  console.log(`子任务(${r.nodes.length})：`);
  r.nodes.forEach((n, i) => console.log(`  ${String(i + 1).padStart(2)}. ${n.id}  ${n.title}`));
  if (r.cyclic) {
    console.log(`[环] 存在依赖环 ${(r.cyclePath ?? []).join(" -> ") || "(未能定位)"}，需人工仲裁。`);
  } else {
    console.log(`拓扑序(${titles.length})：`);
    titles.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t}`));
  }
}

async function promptsCmd(): Promise<void> {
  const p = readPrompts();
  const sections: Array<[string, string]> = [
    ["① 总纲提示词(maestro)", p.maestro],
    ["② 工具调用提示词(decision)", p.decision],
    ["③ 守卫提示词(guard)", p.guard],
    ["④ 总结提示词(review)", p.review],
  ];
  for (const [title, body] of sections) {
    console.log(`\n==== ${title} ====`);
    console.log(body);
  }
  console.log(`\n[来源] core/src/prompts.ts — 与 docs/system-prompts.md 四段一一对应。`);
}

async function chatCmd(): Promise<void> {
  const baseDir = process.cwd();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
  });
  console.log("烛龙·赤水 交互会话 — 输入任务执行；`exit` 或 Ctrl+C 退出。");

  return new Promise<void>((resolve) => {
    rl.on("SIGINT", () => {
      console.log("\n[zhulong] 再见。");
      rl.close();
      resolve();
    });
    rl.setPrompt("烛命> ");
    rl.prompt();

    rl.on("line", async (raw) => {
      const input = raw.trim();
      if (input === "" ) {
        rl.prompt();
        return;
      }
      if (input === "exit" || input === "quit") {
        rl.close();
        resolve();
        return;
      }
      // 每次任务一个全新的不可逆流水线实例，确保阶段上下文不串。
      await runAndPrint(input, "normal", baseDir);
      rl.prompt();
    });

    rl.on("close", () => resolve());
  });
}

// ---------------------------------------------------------------------------
// 命令接线
// ---------------------------------------------------------------------------

const program = new Command();
program
  .name("zhulong")
  .description("烛龙·赤水 — 纯 TypeScript 自研 Agent CLI")
  .version("0.1.0");

program
  .command("run <task>")
  .description("非交互跑一次任务，消费 loop 事件并打印。")
  .option("--mode <mode>", "normal | accept", "normal")
  .option("--cwd <dir>", "工具执行根目录", process.cwd())
  .action((task: string, opts: { mode?: string; cwd?: string }) => runCmd(task, opts));

program
  .command("chat")
  .description("多轮交互 REPL，直到输入 exit / Ctrl+C。")
  .action(() => chatCmd());

program
  .command("prompts")
  .description("打印 docs 里的四段烛命提示词(core/src/prompts)。")
  .action(() => promptsCmd());

program
  .command("plan <task>")
  .description("只运行 DAG 规划器(不执行工具)，打印拓扑序子任务。")
  .action((task: string) => planCmd(task));

// 优雅处理 SIGINT；chat 由 readline 自行接管。
process.on("SIGINT", () => {
  process.stdout.write("\n[zhulong] 已退出。\n");
  process.exit(0);
});

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`[error] ${(err as Error).message}`);
  process.exit(1);
});