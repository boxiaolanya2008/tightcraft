/**
 * tools.ts —— 自研工具注册表，fs_list / fs_read / fs_write 以类型化工具封装。
 *
 * 所有文件操作都被约束在 baseDir 之内(解析后的路径必须落在 baseDir 前缀下)，
 * 防止目录穿越。写入由上游 loop 层做「模式 + 写前读」守卫，本层只管执行。
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { Capability } from "./types";
import type { ToolArgs, ToolResult, FsListArgs, FsReadArgs, FsWriteArgs } from "./types";

interface ToolDefinition<TSchema extends ToolArgs = ToolArgs> {
  readonly name: string;
  readonly capability: Capability;
  readonly description: string;
  run(this: ToolContext, args: TSchema): ToolResult | Promise<ToolResult>;
}

export interface ToolContext {
  baseDir: string;
}

/** 将任意路径安全解析到 baseDir 内，越界抛错。 */
function resolveInside(baseDir: string, target: string): string {
  const abs = path.resolve(baseDir, target);
  const relative = path.relative(baseDir, abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`path escapes workspace root: ${target}`);
  }
  return abs;
}

const listDef: ToolDefinition<FsListArgs> = {
  name: "fs_list",
  capability: "tool.fs_list",
  description: "列出指定目录下的条目(目录/文件名称与类型)。",
  async run(this: ToolContext, args) {
    const dir = String(args.path ?? ".");
    try {
      const abs = resolveInside(this.baseDir, dir);
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
      }));
      return { ok: true, data: { dir, items, count: items.length } };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};

const readDef: ToolDefinition<FsReadArgs> = {
  name: "fs_read",
  capability: "tool.fs_read",
  description: "读取文件内容(最多 16KB)。",
  async run(this: ToolContext, args) {
    try {
      const abs = resolveInside(this.baseDir, String(args.path));
      const raw = await fs.readFile(abs, "utf8");
      const truncated = raw.length > 16384;
      return {
        ok: true,
        data: {
          path: args.path,
          content: truncated ? raw.slice(0, 16384) + "\n…[截断]" : raw,
          bytes: raw.length,
          truncated,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};

const writeDef: ToolDefinition<FsWriteArgs> = {
  name: "fs_write",
  capability: "tool.fs_write",
  description: "写入文件内容(仅在 accept 模式且目标已被先读/先见时由 loop 放行)。",
  async run(this: ToolContext, args) {
    try {
      const abs = resolveInside(this.baseDir, String(args.path));
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, String(args.content), "utf8");
      return { ok: true, data: { path: args.path, bytes: String(args.content).length } };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};

export class ToolRegistry {
  private readonly defs = new Map<string, ToolDefinition>();

  constructor(readonly baseDir: string) {
    this.register(listDef);
    this.register(readDef);
    this.register(writeDef);
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }

  names(): string[] {
    return [...this.defs.keys()];
  }

  capabilityOf(name: string): Capability | undefined {
    return this.defs.get(name)?.capability;
  }

  /** 执行工具。若工具不存在视为错误结果(而非抛异常)。 */
  async run(name: string, args: ToolArgs): Promise<ToolResult> {
    const def = this.defs.get(name);
    if (!def) {
      return { ok: false, error: `unknown tool: ${name}` };
    }
    const ctx: ToolContext = { baseDir: this.baseDir };
    try {
      return await def.run.call(ctx, args);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private register(def: ToolDefinition): void {
    this.defs.set(def.name, def);
  }
}