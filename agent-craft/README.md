# agent-craft

Agent 工程化能力外延工具箱：在基础行为工具箱(thinking / coding / dev / tool / ui / output / memory / commit / github)之上，补齐尚未覆盖的八项**可落地** Agent 能力。纯文档驱动，无外部脚本，随读随用。

## 覆盖能力(新增)

| 模块 | 解决的问题 |
|---|---|
| `planning` | 大任务起手：契约化拆解、依赖 DAG、验收向后构成 |
| `debugging` | 报错定位：复现优先、二分收敛、证据链、变量隔离 |
| `testing` | 让行为可证明：金字塔、可测性判定、先红后绿 |
| `refactoring` | 行为保持的结构变更：安全网、小步切换、零漂移 |
| `agent-loop` | 多步工具编排：执行状态机、失败恢复、可回滚 |
| `research` | 信息采集：一手源优先、溯源级、交叉核验、反幻觉 |
| `security` | 攻击面审查：注入/密钥/越权 + Agent 侧最小权限 |
| `context-governance` | 长会话：锁存指纹复用于控制 token、预算失闸 |

每域统一 **硬边界 → 教学引导 → 反味规避 → 良/劣例** 结构，与基础工具箱风格一致。

## Quick Start

1. 读 `SKILL.md`(入口 + 路由表)。
2. `modules/antipatterns.md` 作跨域通用反味库，恒生效。
3. 按任务对决路由加载模块；任务重叠并行加载。

## 使用原则

- 输出是可执行动作(带契约的命令/清单/判定)，非"理论上应该……"。
- 引用事实必溯源；动作必可复现、带验证出口。
- 不触碰未涉及之物：write/edit 只改目标区。

## License / 贡献

与主仓库相同；新增能力按 Conventional Commits 原子提交。