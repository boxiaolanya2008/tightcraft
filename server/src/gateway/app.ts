/**
 * gateway/app.ts —— 自研 Express 网关：
 * REST + SSE。所有路由在执行业务前先过 access.guard(gateway, capability)。
 * /run 以 text/event-stream 推送 loop 的类型化事件，并在收束时回写 assistant 消息。
 */

import * as path from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { guard, type Capability } from "../engine/access";
import { runLoop, type DonePayload, type ErrorPayload } from "../engine/loop";
import { MockProvider, type Mode } from "../engine/provider";
import { ToolRegistry } from "../engine/tools";
import { threadStore, type ToolRecord } from "../store/threads";
import { readPrompts } from "../prompts";

/** 工具执行根目录：一律落在仓库根(workspace)，便于演示列目录/读文档/写探针。 */
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.disable("x-powered-by");

  /** 路由级授权中间件：任何业务入口先过 guard。 */
  function authorize(capability: Capability) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
      guard("gateway", capability); // 越权直接抛 AccessDenied → 走错误处理器
      next();
    };
  }

  // 健康检查
  app.get("/api/health", authorize("sse.expose"), (_req, res) => {
    res.json({ status: "ok", name: "zhulong", service: "zhulong-web", ts: Date.now() });
  });

  // 烛命提示词(供前端 SystemPromptsPanel 拉取)
  app.get("/api/prompts", authorize("prompts.read"), (_req, res) => {
    res.json(readPrompts());
  });

  // 会话列表
  app.get("/api/threads", authorize("store.threads"), (_req, res) => {
    res.json(threadStore.list());
  });

  // 新建会话
  app.post("/api/threads", authorize("store.threads"), (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title : undefined;
    const thread = threadStore.create(title);
    res.status(201).json(thread);
  });

  // 读取单个会话
  app.get("/api/threads/:id", authorize("store.threads"), (req, res) => {
    const thread = threadStore.get(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "thread not found" });
      return;
    }
    res.json(thread);
  });

  // 删除会话
  app.delete("/api/threads/:id", authorize("store.threads"), (req, res) => {
    const ok = threadStore.delete(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "thread not found" });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  });

  // 运行会话：SSE 流
  app.post("/api/threads/:id/run", authorize("sse.expose"), async (req, res) => {
    const thread = threadStore.get(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "thread not found" });
      return;
    }
    const content = typeof req.body?.content === "string" ? req.body.content : "（空任务）";
    const mode: Mode = req.body?.mode === "accept" ? "accept" : "normal";

    threadStore.append(thread.id, { role: "user", text: content });

    const provider = new MockProvider(mode, content);
    const tools = new ToolRegistry(WORKSPACE_ROOT);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    let outcome: { finalText: string; tools: ToolRecord[] } | undefined;

    try {
      for await (const ev of runLoop({ task: content, mode, role: "core", provider, tools })) {
        res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev.payload)}\n\n`);
        const flush = (res as unknown as { flush?: () => void }).flush;
        if (typeof flush === "function") flush();
        if (ev.type === "done") {
          outcome = ev.payload as DonePayload;
        }
      }
      if (outcome) {
        threadStore.append(thread.id, {
          role: "assistant",
          text: outcome.finalText,
          tools: outcome.tools,
        });
      } else {
        threadStore.append(thread.id, {
          role: "assistant",
          text: "运行被中断或未产出 done 事件。",
        });
      }
    } catch (err) {
      const payload: ErrorPayload = { message: (err as Error).message };
      res.write(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
    }
    res.end();
  });

  // 统一错误处理器：AccessDenied 返回 403
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.name === "AccessDenied" ? 403 : 500;
    res.status(status).json({ error: err.message });
  });

  return app;
}