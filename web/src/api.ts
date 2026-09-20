/**
 * api.ts —— 前端与后端的全部交互：REST + SSE(用 fetch + ReadableStream 手工解析事件帧)。
 */

export interface ToolRecord {
  tool: string;
  status: "ok" | "error";
  note?: string;
  args?: Record<string, unknown>;
  at: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  tools?: ToolRecord[];
  createdAt: number;
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ThreadSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
}

export interface ZhulongPrompts {
  maestro: string;
  decision: string;
  guard: string;
  review: string;
}

export type Mode = "normal" | "accept";

/** 后端 SSE 事件的载荷(与 server loop.ts 对应)。 */
export interface RunEvents {
  tool_start: { id: string; tool: string; args: Record<string, unknown> };
  tool_end: { id: string; tool: string; ok: boolean; error?: string; result?: string };
  text_delta: { text: string };
  error: { message: string };
  done: { finalText: string; tools: ToolRecord[] };
}
export type RunEventType = keyof RunEvents;

/** 判别联合的事件对象，便于按 type 收窄 payload。 */
export type RunEvent =
  | { type: "tool_start"; payload: RunEvents["tool_start"] }
  | { type: "tool_end"; payload: RunEvents["tool_end"] }
  | { type: "text_delta"; payload: RunEvents["text_delta"] }
  | { type: "error"; payload: RunEvents["error"] }
  | { type: "done"; payload: RunEvents["done"] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  listThreads: () => request<ThreadSummary[]>("/api/threads"),
  createThread: (title?: string) =>
    request<Thread>("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  getThread: (id: string) => request<Thread>(`/api/threads/${id}`),
  deleteThread: (id: string) =>
    request<{ deleted: boolean }>(`/api/threads/${id}`, { method: "DELETE" }),

  getPrompts: () => request<ZhulongPrompts>("/api/prompts"),

  /**
   * 运行会话并消费 SSE 流。逐帧 callback；支持 AbortSignal 取消。
   * 依最终 event: done 拼接 finalText 与 tools 一起回调。
   */
  async runThread(
    id: string,
    content: string,
    mode: Mode,
    onEvent: (ev: RunEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`/api/threads/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, mode }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`run failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按空行切分 SSE 事件块
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatchBlock(block, onEvent);
        sep = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) dispatchBlock(buffer, onEvent);
  },
};

function dispatchBlock(block: string, onEvent: (ev: RunEvent) => void): void {
  let eventType: RunEventType | null = null;
  let dataText = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim() as RunEventType;
    else if (line.startsWith("data:")) dataText = line.slice(5).trim();
  }
  if (eventType && dataText) {
    try {
      const payload = JSON.parse(dataText) as RunEvents[RunEventType];
      onEvent({ type: eventType, payload } as RunEvent);
    } catch {
      /* 忽略无法解析的帧 */
    }
  }
}