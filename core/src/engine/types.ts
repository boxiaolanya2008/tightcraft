/**
 * types.ts —— core 的集中类型出口：模式、角色、能力、决策、运行事件、工具参数。
 * 供 core / cli / tui 复用，避免各模块间循环引用。
 */

/** 运行模式：normal 拒绝一切写入；accept 在「写前读」满足时放行写入。 */
export type Mode = "normal" | "accept";

/** 角色：授权最小单元。gateway/ui 为旧 web 层遗留，保留以表意。 */
export type Role = "core" | "tool" | "gateway" | "ui";

/** 能力清单：每一能力被映射到一组允许执行它的角色。 */
export type Capability =
  | "engine.decide"
  | "pipeline.advance"
  | "tool.fs_list"
  | "tool.fs_read"
  | "tool.fs_write"
  | "guard.evaluate"
  | "store.threads"
  | "sse.expose"
  | "prompts.read";

// ---------------------------------------------------------------------------
// 工具层
// ---------------------------------------------------------------------------

export interface ToolArgs {
  [key: string]: unknown;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface FsListArgs extends ToolArgs {
  path?: string;
}
export interface FsReadArgs extends ToolArgs {
  path: string;
}
export interface FsWriteArgs extends ToolArgs {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Provider 决策
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 运行事件(流式)
// ---------------------------------------------------------------------------

export interface ToolStartPayload {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}
export interface ToolEndPayload {
  id: string;
  tool: string;
  ok: boolean;
  error?: string;
  result?: string;
}
export interface TextDeltaPayload {
  text: string;
}
export interface ErrorPayload {
  message: string;
}
export interface PlanPayload {
  orderedSteps: string[];
  cyclic: boolean;
}
export interface DonePayload {
  finalText: string;
  tools: ToolRecord[];
}

/** 会话工具登记记录。 */
export interface ToolRecord {
  tool: string;
  status: "ok" | "error";
  note?: string;
  args?: Record<string, unknown>;
  at: number;
}

/** 类型化运行事件联合。 */
export type RunEvent =
  | { type: "tool_start"; payload: ToolStartPayload }
  | { type: "tool_end"; payload: ToolEndPayload }
  | { type: "text_delta"; payload: TextDeltaPayload }
  | { type: "error"; payload: ErrorPayload }
  | { type: "plan"; payload: PlanPayload }
  | { type: "done"; payload: DonePayload };