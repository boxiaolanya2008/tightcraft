/**
 * pipeline.ts —— 自研不可逆阶段状态机：IDLE → VALIDATE → PLAN → EXECUTE → REVIEW → FINISH。
 *
 * 每次只允许「下一步」合法转移；非法转移抛 IllegalTransition(视为缺陷中断)。
 * 每次转移写入 AuditEntry 审计轨迹，供事后复盘。
 */

export type Stage =
  | "IDLE"
  | "VALIDATE"
  | "PLAN"
  | "EXECUTE"
  | "REVIEW"
  | "FINISH";

/** 全链路的固定顺序。 */
const ORDER: readonly Stage[] = [
  "IDLE",
  "VALIDATE",
  "PLAN",
  "EXECUTE",
  "REVIEW",
  "FINISH",
];

/** 单条审计记录。 */
export interface AuditEntry {
  from: Stage;
  to: Stage;
  /** unix 毫秒时间戳。 */
  at: number;
}

/** 非法转移错误，视为一次缺陷中断。 */
export class IllegalTransition extends Error {
  constructor(
    readonly from: Stage,
    readonly to: Stage,
  ) {
    super(`illegal pipeline transition: ${from} -> ${to}`);
    this.name = "IllegalTransition";
  }
}

/**
 * 一次运行的全链路工作流对象。不可逆、可审计。
 * 脱离本对象即退出阶段上下文，因此每次 run 都应创建一个新实例。
 */
export class Pipeline {
  private current: Stage = "IDLE";
  private readonly trail: AuditEntry[] = [];

  /** 当前所处阶段。 */
  stage(): Stage {
    return this.current;
  }

  /**
   * 目标是否就是连续合法地可达的下一个阶段？
   * 仅当 step 恰好等于当前阶段在 ORDER 中的后继时才返回 true。
   */
  can(step: Stage): boolean {
    const idx = ORDER.indexOf(this.current);
    if (idx === -1) return false;
    return ORDER[idx + 1] === step;
  }

  /**
   * 转移阶段。非法转移直接抛 IllegalTransition。
   * 转移成功后在审计轨迹上追加一条记录。
   */
  transition(step: Stage): this {
    if (!this.can(step)) {
      throw new IllegalTransition(this.current, step);
    }
    this.trail.push({ from: this.current, to: step, at: Date.now() });
    this.current = step;
    return this;
  }

  /** 只读的审计轨迹快照。 */
  auditTrail(): readonly AuditEntry[] {
    return this.trail.slice();
  }

  /** 是否已到达 FINISH。 */
  isFinished(): boolean {
    return this.current === "FINISH";
  }
}