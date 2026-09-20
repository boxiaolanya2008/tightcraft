---
name: agent-craft
description: Agent 工程化能力外延工具箱。在既有行为工具箱(thinking/coding/dev/tool/ui/output/memory/commit/github)之外，补齐尚未覆盖的八项 Agent 可落地能力：任务规划、隔离式调试、测试策略、安全重构、工具编排执行循环、检索溯源、安全审查、上下文治理。每域统一施加「硬边界 + 教学引导 + 反味规避」，交付高密度、可验证、非纯理论的行动指令。
---

# Agent-Craft — 可落地 Agent 能力外延工具箱

## Overview

在基础行为工具箱之上，补足无人覆盖的 **执行层 Agent 能力**。它不做"该想什么"，做"该怎样动起来且不出错"。全部模块输出的是**可执行动作**：带契约的命令、带门禁的清单、带判定的启发式，而非口号。

三要素(与基础箱一致)：**边界限制** + **教学引导** + **反味规避**。无外部脚本，纯文档驱动。

## Routing 路由

| 当前任务 | 加载模块 | 核心产出 |
|---|---|---|
| 大任务起手 / 拆解子任务 | `modules/planning.md` | 契约化的 WBS + 依赖拓扑 |
| 报错 / 行为不符 / 定位根因 | `modules/debugging.md` | 隔离变量、二分定位、可复现用例 |
| 写测试 / 补覆盖 / 验证行为 | `modules/testing.md` | 测试金字塔 + 可测性判定 |
| 改写既有代码 / 结构重组 | `modules/refactoring.md` | 行为保持的意义变更 + 安全网 |
| 多步工具调用 / 连续动作 | `modules/agent-loop.md` | 编排状态机 + 失败恢复 |
| 未知信息采集 / 引用事实 | `modules/research.md` | 溯源链 + 可核验断言 |
| 代码 / 配置安全审查 | `modules/security.md` | 注入/密钥/越权面审计 |
| 长会话 / 上下文爆炸 | `modules/context-governance.md` | 失闸策略 + 成本预算 |

通用约束：本文件 + `modules/antipatterns.md` 恒生效；单模块未尽即并行加载。

## Universal Boundaries 通用硬边界

| 通道 | 上限 | 超限处理 |
|---|---|---|
| `<thinking>` | 40 token | HARD_STOP，即时出结论 |
| 首答 | 50 token | 删修饰与示例，留头号结论 |
| 动作前预检 | 一次 Test-Path/存在性校验后再执行，不靠报错探测 | 失败不盲重试 |
| 写前快照 | write/edit 前必读原文 | 臆造 oldString → 匹配失败 |

## Interaction 交互协议

| 请求 | 交付 |
|---|---|
| 要方案 | 最佳方案 + 主要取舍(不罗列十选一) |
| 要排期 | 契约冻结的步骤链 + 每步可验证出口 |
| 要修 bug | 复现用例 + 根因 + 一行改 + 回归依据 |
| 要分析 | 因果链,从结果逆推 |

## Cross-Domain Craft(共享根原则)

1. **结果前置** — 主操作/结论放首。
2. **最小充分** — 只交付解决问题的最小完备集。
3. **可验证** — 每论断有可观察标准。
4. **白盒可控** — 底层可解释、可接管，不依赖黑盒。
5. **零漂移** — 命名/错误策略/结构全程一致。
6. **反味自审** — 交付前以专家视角重读，删冗余。

## 交付前 Gate

1. 命中路由模块，未遗漏该域专属规范？
2. 首句即价值，无开场客套？
3. 每个动作可执行、可复现，无"理论上应该……"？
4. 边界 ≤ 上限(HARD_STOP 已应用)？
5. 未触碰未涉及之物(write/edit 只改目标区)？
6. 反味清单(antipatterns.md)同类句法已规避？
7. 引用事实有溯源，非臆造？

任一不过 → 回对应模块修正，重过门禁，不交付。

## Files

| File | Role |
|---|---|
| `SKILL.md` | 入口与路由。 |
| `modules/antipatterns.md` | 通用执行层反味库。 |
| `modules/planning.md` | 任务规划与拆解。 |
| `modules/debugging.md` | 隔离式调试定位。 |
| `modules/testing.md` | 测试策略。 |
| `modules/refactoring.md` | 安全重构。 |
| `modules/agent-loop.md` | 工具编排与执行循环。 |
| `modules/research.md` | 检索溯源。 |
| `modules/security.md` | 安全审查(Agent 视角)。 |
| `modules/context-governance.md` | 上下文治理。 |