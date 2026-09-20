# 烛龙 Zhulong — 自研 Agent 引擎 + CLI + TUI(TypeScript monorepo)

> 烛照九幽，龙腾万化。
> 纯 TypeScript 自研 Agent 工程，走向 AGI 技术路线：
> 引擎核心(core)完全自研，UI 为 CLI / TUI(无 HTML)，不依赖任何开源 Agent 框架。

## 命名与文化内核

本项目以中国传统神话《山海经·大荒北经》的 **烛龙** 命名：

> 「有神，人面蛇身而赤，直目正乘。其瞑乃晦，其视乃明。……是烛九阴，是谓烛龙。」

**瞑乃晦，视乃明** —— 闭眼则天地幽暗，睁眼则光华普照。这是智能体面对
混沌代码/任务的核心隐喻：未读未查之前一切皆黑箱，一经烛照则因果分明。

详见 [docs/naming-system.md](docs/naming-system.md) 与
[docs/system-prompts.md](docs/system-prompts.md)(专属「烛命」系统提示词)。

## 定位

纯 TypeScript + Node 的自研 Agent：引擎核心 `core/`、命令行 `cli/`、终端界面 `tui/`(ink + react)。
引擎逻辑(流程状态机、权限守卫、工具注册表、流式循环、Provider、DAG 规划、指纹记忆)全部自研。

底层自研工程化：
- **不可逆流程状态机(core/src/engine/pipeline)**：IDLE→VALIDATE→PLAN→EXECUTE→REVIEW→FINISH + 审计轨迹。
- **角色/能力授权守卫(core/src/engine/access)**：任意入口先过 guard(role, capability)。
- **工具注册表(core/src/engine/tools)**：fs_list/fs_read/fs_write，限制在 baseDir 内防目录穿越。
- **流式执行循环(core/src/engine/loop)**：写前读 + accept 模式门禁；支持规划时产出 `plan` 事件。
- **可插拔 Provider(core/src/engine/provider)**：离线 Mock / 在线 OpenAI 兼容，工厂 `createProvider`。
- **AGI 增强**：`planner.ts`(DAG 任务规划·拓扑排序)、`memory.ts`(指纹记忆·内容哈希锁存)。

## Quick Start

```bash
npm install      # 安装 core/cli/tui 及其依赖(Node 24+)
npm run build    # 依次构建 core → cli → tui
```

### CLI(烛龙·赤水)

```bash
npm run cli -- run "列出仓库根目录"              # 或 node cli/dist/index.js run "…"
node cli/dist/index.js run "…" --mode accept    # accept 模式(写前读满足才放行写入)
node cli/dist/index.js chat                     # 多轮交互 REPL，exit 退出
node cli/dist/index.js prompts                  # 打印四段烛命提示词
node cli/dist/index.js plan "写一个待办模块并加到 README"  # 只做 DAG 规划，打印拓扑序
```

### TUI(烛龙·九幽)

```bash
node tui/dist/index.js
# 底部输入框回车执行；输入为空时 Q 退出、M 切换 normal/accept
```

## 目录

```
├── core/               @zhulong/core  自研引擎核心(无外部依赖)
│   └── src/
│       ├── engine/
│       │   ├── pipeline.ts    # 不可逆阶段状态机
│       │   ├── access.ts      # 角色/能力授权守卫
│       │   ├── tools.ts       # 工具注册表(写前读 + accept)
│       │   ├── loop.ts        # 流式执行循环(plan/tool/text/error/done 事件)
│       │   ├── provider.ts    # Mock / OpenAI 可插拔 Provider + 工厂
│       │   ├── planner.ts     # DAG 任务规划(拓扑排序)
│       │   ├── memory.ts      # 指纹记忆(内容哈希锁存)
│       │   └── types.ts       # 集中类型(Decision/Mode/Role/Capability/RunEvent)
│       ├── store/threads.ts   # 会话存储
│       ├── prompts.ts         # 烛命提示词
│       └── index.ts           # 公共 API
├── cli/                @zhulong/cli  命令行(run/chat/prompts/plan)
├── tui/                @zhulong/tui  TUI(ink + react)
├── docs/               命名体系 + 系统提示词
├── package.json         workspaces: core/cli/tui
└── tsconfig.base.json
```

## 在线 Provider 环境变量

```bash
export ZL_API_KEY=sk-...         # 触发在线 Provider 的关键
export ZL_MODEL=gpt-4o-mini      # 需要与 ZL_API_KEY 同时存在
export ZL_BASE_URL=https://api.openai.com/v1   # 可选，默认即此
```

## 软件许可

MIT