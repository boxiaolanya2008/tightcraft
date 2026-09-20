/**
 * core/src/index.ts —— @zhulong/core 公共 API 出口。
 * 供 CLI / TUI 复用的引擎、工具、规划、记忆、会话、提示词。
 */

// 引擎基础
export * from "./engine/types";
export { Pipeline, IllegalTransition } from "./engine/pipeline";
export type { Stage, AuditEntry } from "./engine/pipeline";
export {
  AccessDenied,
  can,
  guard,
  capabilityPolicy,
} from "./engine/access";
export { ToolRegistry } from "./engine/tools";
export type { ToolContext } from "./engine/tools";

// Provider
export {
  MockProvider,
  OpenAIProvider,
  createProvider,
  PROBE_WRITE_PATH,
} from "./engine/provider";
export type { Provider, OpenAIConfig, CreateProviderOptions } from "./engine/provider";

// 执行循环
export { runLoop } from "./engine/loop";
export type { RunParams } from "./engine/loop";

// AGI 增强：DAG 规划 + 指纹记忆
export { plan, orderedTitles } from "./engine/planner";
export type { PlanNode, PlanResult } from "./engine/planner";
export { FingerprintMemory, memory } from "./engine/memory";

// 会话与提示词
export { ThreadStore, threadStore } from "./store/threads";
export type { Message, Thread, ThreadSummary, Role as MessageRole } from "./store/threads";
export { readPrompts } from "./prompts";
export type { ZhulongPrompts } from "./prompts";