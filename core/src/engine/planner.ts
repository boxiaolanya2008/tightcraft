/**
 * planner.ts —— 自研 DAG 任务规划器(拓扑排序)。
 *
 * 输入任务文本，切成若干子任务节点，建立依赖边，做拓扑排序(Kahn 算法)。
 * 无环返回可执行的有序列表；有环标记 cyclic 并给出环路径，交由仲裁。
 */

export interface PlanNode {
  /** 稳定 id，如 n0 / n1。 */
  id: string;
  /** 子任务标题(来自任务文本切分)。 */
  title: string;
}

export interface PlanResult {
  task: string;
  nodes: PlanNode[];
  /** 拓扑序，元素为节点 id。无环时为有序执行列表；有环时是「已排定的部分序」。 */
  order: string[];
  cyclic: boolean;
  /** 命中的环路径(部分或完整)，供仲裁参考。 */
  cyclePath?: string[];
}

/** 分隔子任务的连接词/标点。 */
const SPLIT_RE = /[、，,;；\n。]|并|且|然后|随后|再|接着|之后|和|与/;

/** 显式依赖箭头：A -> B / A => B / A > B。 */
const ARROW_RE = /\s*(?:-{2}>|->|=>|>)\s*/;

/**
 * 将任务文本切成子任务节点并建立依赖边。
 * 优先识别显式箭头；否则按连接词/标点切分，取先后顺序构成线性链。
 */
export function plan(task: string): PlanResult {
  const trimmed = task.trim();
  const parts = trimmed.split(ARROW_RE).map((s) => s.trim()).filter(Boolean);

  let titles: string[];
  if (parts.length > 1) {
    titles = parts;
  } else {
    titles = trimmed.split(SPLIT_RE).map((s) => s.trim()).filter(Boolean);
    if (titles.length === 0) titles = [trimmed];
  }

  const nodes: PlanNode[] = titles.map((t, i) => ({ id: `n${i}`, title: t }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 邻接表：nodes[i] -> nodes[i+1]（线性链）。
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (let i = 0; i < nodes.length - 1; i++) {
    adj.get(nodes[i].id)!.push(nodes[i + 1].id);
  }

  // Kahn 拓扑排序。
  const indegree = new Map<string, number>();
  for (const n of nodes) indegree.set(n.id, 0);
  for (const [from, tos] of adj) {
    for (const to of tos) indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }

  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const to of adj.get(id) ?? []) {
      const d = (indegree.get(to) ?? 0) - 1;
      indegree.set(to, d);
      if (d === 0) queue.push(to);
    }
  }

  const visited = new Set(order);
  const doneSet = new Set(nodes.map((n) => n.id));
  const cyclic = visited.size !== doneSet.size;
  const leftover = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);

  return {
    task,
    nodes,
    order,
    cyclic,
    cyclePath: cyclic ? leftover : undefined,
  };
}

/** 把 PlanResult 展开为按拓扑序排列的子任务标题。 */
export function orderedTitles(r: PlanResult): string[] {
  const byId = new Map(r.nodes.map((n) => [n.id, n.title]));
  return r.order.map((id) => byId.get(id) ?? id);
}