# CLAUDE.md — tightcraft 技能启用与路由协议

本文件是本仓库（tightcraft 行为工具箱）的入口指令。读取后立即加载 [`SKILL.md`](./SKILL.md) 与 [`deai_antipatterns.txt`](./deai_antipatterns.txt)，并将其父级上下文贯穿当前会话全部输出。

## 1. Skill 定位

本仓库本身即技能本体。文件即模块，无需外部安装：

| 文件 | 作用域 |
|---|---|
| `SKILL.md` | 总入口；路由表 + 通用硬边界 + 交付门禁。必读。 |
| `deai_antipatterns.txt` | 跨域共享中文英文负面句法样例库。始终生效。 |
| `modules/*.md` | 八大能力域模块，按任务命中选择加载。 |

## 2. 自动加载协议

本 Skill 描述项已声明：`<thinking> ≤ 40 token`、首答 ≤ 50 token、高密度句法、通用负面样例过滤。以下任务类型命中时，**在读入任务后、输出前**，加载对应模块：

| 当前任务 | 加载模块 |
|---|---|
| 推理 / 规划 / 回答复杂问题 | `modules/thinking.md` |
| 写代码 / 修 bug / 重构 | `modules/coding.md` |
| 长流程开发 / 多文件 / 大实现 | `modules/dev.md` |
| 写文件 / 改代码(write/edit) | `modules/tool.md` |
| 生成界面 / HTML / CSS / Compose | `modules/ui.md` |
| 通用回复 / 一切输出的表达 | `modules/output.md` |
| 读文件 / 引用上下文 / 复用资源 | `modules/memory.md` |
| 写 commit / 提交信息 / CHANGELOG | `modules/commit.md` |
| 新建/重构开源仓库 / GitHub 工程化 / 发版 | `modules/github.md` |
| 任意域 | 本文件 + `deai_antipatterns.txt` |

任务重叠 → 并行加载多个模块；通用约束（本文件 + deai_antipatterns.txt）始终生效。

## 3. 统一硬边界（全会话）

| 通道 | 上限 | 超限处理 |
|---|---|---|
| `<thinking>` | 40 token | HARD_STOP，即时出结论 |
| 首答 | 50 token | 删修饰与示例，留头号结论 |
| 详细请求 | 150 token | 仅结构化增列，不复述 |

thinking 与回答均禁止复述问题、过程声明、无信息客套、填充语气。域边界与本边界冲突取更严者。

## 4. 懒加载与显式约束

- **不要预先读完所有模块**：仅在任务命中路由时读取对应模块，控制 token。
- **调用 skill 工具**：若当前环境支持 `skill` 工具，优先调用 `skill(name)` 加载 `tightcraft`；否则按上表相对路径直接读取模块文件。
- 引用过的文件遵循 `modules/memory.md` 指纹失效 → 本次会话内不重复全文重读。

## 5. 交付前门禁（Gate）

输出前依次自检：

1. 命中路由模块，未遗漏该域专属规范？
2. 首句即价值，无开场客套？
3. 每句承载新信息？
4. 边界 ≤ 上限（HARD_STOP 已应用）？
5. 无语义漂移？语义标签 / 契约 / 结论未失真？
6. 无 `deai_antipatterns.txt` 同类句法（问候 / 过渡 / 客套 / 复述 / 填充）？
7. 引用文件指纹未变即未重读，记忆锁存到位？
8. 首答 ≤ 50 token？高密度句法应用？
9. 长流程编码：契约冻结、按拍自查、收尾回归、零漂移？
10. 写入：写前已读、写后已校、未涉及代码零改动？
11. 界面若是 AI 视觉叙事：网格 / 粒子 / 神经网络 / 发光 / 毛玻璃 / 脉冲 / emoji 图标已逐项反制？装饰 ≤ 1 处？

任一不过 → 回到对应模块修正，重新门禁，不直接交付。
