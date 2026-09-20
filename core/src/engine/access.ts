/**
 * access.ts —— 自研角色/能力授权守卫。
 *
 * 以「角色」为授权最小单元：任意入口在执行业务前必须过 guard(role, capability)，
 * 越权即抛 AccessDenied。本模块只做授权判定，不持有任何业务逻辑。
 */

import type { Role, Capability } from "./types";

/** 能力 → 允许角色 策略表。 */
const POLICY: Readonly<Record<Capability, readonly Role[]>> = {
  "engine.decide": ["core"],
  "pipeline.advance": ["core"],
  "tool.fs_list": ["core", "tool"],
  "tool.fs_read": ["core", "tool"],
  "tool.fs_write": ["core", "tool"],
  "guard.evaluate": ["core"],
  "store.threads": ["gateway"],
  "sse.expose": ["gateway", "ui"],
  "prompts.read": ["gateway", "ui"],
};

/** 越权异常。 */
export class AccessDenied extends Error {
  constructor(
    readonly role: Role,
    readonly capability: Capability,
  ) {
    super(`access denied: 角色「${role}」无权执行能力「${capability}」`);
    this.name = "AccessDenied";
  }
}

/** 判断某角色是否可执行某能力。 */
export function can(role: Role, capability: Capability): boolean {
  return POLICY[capability].includes(role);
}

/** 守卫生成能力映射的策略表(只读快照，便于审计与测试)。 */
export function capabilityPolicy(): Readonly<Record<string, readonly Role[]>> {
  return POLICY;
}

/** 授权守卫：无权限即抛 AccessDenied。 */
export function guard(role: Role, capability: Capability): void {
  if (!can(role, capability)) {
    throw new AccessDenied(role, capability);
  }
}