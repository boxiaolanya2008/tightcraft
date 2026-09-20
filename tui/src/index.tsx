/**
 * tui/src/index.tsx —— 烛龙·九幽 TUI。
 *
 * ink + react 渲染到终端：底部输入框、滚动消息区、工具块(●运行中/✓ok/✗err)、
 * 模式切换、Q 退出、M 切换模式。回车调用 @zhulong/core 的 runLoop，实时渲染事件。
 * 输入框为自研(useInput 逐键拼装)，不依赖第三方程组件。
 */

import React, { useState, useCallback, useRef } from "react";
import { Box, Text, useInput, render } from "ink";
import { createProvider, runLoop, ToolRegistry, type Mode, type RunEvent } from "@zhulong/core";

interface Row {
  key: number;
  kind: "user" | "assistant" | "system" | "tool" | "plan" | "done";
  text: string;
  id?: string; // 工具 id，用于 tool_end 更新状态
  status?: "running" | "ok" | "err";
}

let keySeed = 0;
const maxRows = 60;

function kv(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
}

function rowOf(kind: Row["kind"], text: string, extra?: Partial<Row>): Row {
  return { key: keySeed++, kind, text, ...extra };
}

function ZhulongApp() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("normal");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;
  const runningRef = useRef(running);
  runningRef.current = running;

  const update = useCallback((mut: (prev: Row[]) => Row[]) => {
    setRows((prev) => {
      const next = mut(prev);
      return next.length > maxRows ? next.slice(next.length - maxRows) : next;
    });
  }, []);

  const handleEvent = useCallback(
    (ev: RunEvent) => {
      switch (ev.type) {
        case "plan":
          update((p) => [
            ...p,
            rowOf("plan", `规划 → ${ev.payload.orderedSteps.join(" → ") || "(空)"}`),
          ]);
          break;
        case "text_delta":
          update((p) => [...p, rowOf("assistant", ev.payload.text.replace(/\n$/, ""))]);
          break;
        case "tool_start":
          update((p) => [
            ...p,
            rowOf("tool", `● ${ev.payload.tool} ${kv(ev.payload.args)}`, {
              id: ev.payload.id,
              status: "running",
            }),
          ]);
          break;
        case "tool_end":
          update((p) =>
            p.map((r) =>
              r.id === ev.payload.id
                ? {
                    ...r,
                    status: ev.payload.ok ? ("ok" as const) : ("err" as const),
                    text: `${
                      ev.payload.ok ? "✓" : "✗"
                    } ${ev.payload.tool}${ev.payload.ok && ev.payload.result ? ` → ${ev.payload.result}` : ""}${
                      !ev.payload.ok ? ` ${ev.payload.error ?? "失败"}` : ""
                    }`,
                  }
                : r,
            ),
          );
          break;
        case "error":
          update((p) => [...p, rowOf("system", `[error] ${ev.payload.message}`)]);
          break;
        case "done":
          update((p) => [
            ...p,
            rowOf("system", "—— done ——"),
            ...ev.payload.finalText
              .split("\n")
              .filter(Boolean)
              .map((l) => rowOf("done", l)),
            rowOf(
              "system",
              `[汇总] 工具 ${ev.payload.tools.length} 次(${
                ev.payload.tools.filter((t) => t.status === "ok").length
              } 成功)。`,
            ),
          ]);
          break;
      }
    },
    [update],
  );

  const submit = useCallback(
    async (value: string) => {
      const task = value.trim();
      if (!task || runningRef.current) {
        setInput("");
        return;
      }
      setInput("");
      setRunning(true);
      update((p) => [...p, rowOf("user", `我: ${task}`)]);

      const atMode = mode;
      try {
        const provider = createProvider(atMode, task);
        const tools = new ToolRegistry(process.cwd());
        for await (const ev of runLoop({ task, mode: atMode, role: "core", provider, tools })) {
          handleEvent(ev);
        }
      } catch (err) {
        update((p) => [...p, rowOf("system", `[error] ${(err as Error).message}`)]);
      } finally {
        setRunning(false);
      }
    },
    [mode, update, handleEvent],
  );

  // 自研输入行：逐键拼装；输入为空时 Q 退出、M 切换模式。
  useInput((typed, key) => {
    if (key.backspace) {
      setInput((s) => s.slice(0, -1));
      return;
    }
    if (key.escape) {
      setInput("");
      return;
    }
    if (key.ctrl && typed === "c") {
      process.exit(0);
    }
    if (key.return) {
      void submit(inputRef.current);
      return;
    }
    const plain = typed.trim();
    if (plain === "") return;
    const lower = plain.toLowerCase();
    if (inputRef.current === "") {
      if (lower === "q") process.exit(0);
      if (lower === "m") {
        setMode((m) => (m === "accept" ? "normal" : "accept"));
      }
      return;
    }
    if (!key.ctrl && !key.meta) {
      setInput((s) => s + typed);
    }
  },
  // 非 TTY(管道/无终端)下不开启 raw 输入，避免 ink 抛「Raw mode is not supported」。
  { isActive: process.stdin.isTTY === true });

  const shown = rows.slice(-18);

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" marginY={1}>
        <Box>
          <Text bold color="#ff6b1a">
            {"烛龙·九幽"}
          </Text>
          <Text dimColor>
            {"  —  自研 Agent TUI"}
          </Text>
        </Box>
        <Text dimColor>
          {`模式:${mode === "accept" ? "accept(可写)" : "normal(只读)"}`}
        </Text>
      </Box>

      <Box flexDirection="column" height={14} borderStyle="round" borderColor="gray" marginBottom={1}>
        {shown.length === 0 ? (
          <Text dimColor>暗昧未明，先观而察——输入任务回车执行。</Text>
        ) : (
          shown.map((r) => {
            switch (r.kind) {
              case "user":
                return (
                  <Text key={r.key} color="cyan">
                    {r.text}
                  </Text>
                );
              case "tool":
                return (
                  <Text key={r.key} color={r.status === "err" ? "red" : r.status === "ok" ? "green" : "yellow"}>
                    {r.text}
                  </Text>
                );
              case "plan":
                return (
                  <Text key={r.key} color="magenta">
                    {r.text}
                  </Text>
                );
              case "system":
                return (
                  <Text key={r.key} dimColor>
                    {r.text}
                  </Text>
                );
              case "done":
                return (
                  <Text key={r.key} bold>
                    {r.text}
                  </Text>
                );
              default:
                return <Text key={r.key}>{r.text}</Text>;
            }
          })
        )}
      </Box>

      <Text bold color={running ? "yellow" : "green"}>
        {"❯ " + input}
      </Text>

      <Text dimColor>
        {"输入为空时: Q 退出    M 切换 normal/accept    Esc 清空    Enter 执行"}
      </Text>
    </Box>
  );
}

render(<ZhulongApp />);