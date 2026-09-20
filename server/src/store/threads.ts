/**
 * threads.ts —— 内存会话/消息存储：create / list / get / delete / append。
 *
 * 单例 threadStore 供网关(SelfGateway，角色 gateway)读写。无持久化，进程重启即清空。
 */

import { randomUUID } from "node:crypto";

export type Role = "user" | "assistant" | "system";

export interface ToolRecord {
  tool: string;
  status: "ok" | "error";
  note?: string;
  args?: Record<string, unknown>;
  at: number;
}

export interface Message {
  id: string;
  role: Role;
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

export class ThreadStore {
  private readonly threads = new Map<string, Thread>();

  create(title?: string): Thread {
    const thread: Thread = {
      id: cryptoId(),
      title: (title ?? "").trim().slice(0, 40) || "新建明烛",
      messages: [],
      createdAt: Date.now(),
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  get(id: string): Thread | undefined {
    return this.threads.get(id);
  }

  list(): ThreadSummary[] {
    return [...this.threads.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        id: t.id,
        title: t.title,
        messageCount: t.messages.length,
        createdAt: t.createdAt,
      }));
  }

  delete(id: string): boolean {
    return this.threads.delete(id);
  }

  append(
    threadId: string,
    msg: Omit<Message, "id" | "createdAt">,
  ): Message | undefined {
    const thread = this.threads.get(threadId);
    if (!thread) return undefined;
    const full: Message = { ...msg, id: cryptoId(), createdAt: Date.now() };
    thread.messages.push(full);
    return full;
  }
}

function cryptoId(): string {
  return randomUUID();
}

/** 全局单例：可与 Simple Gateway 共享。 */
export const threadStore = new ThreadStore();