# 烛龙 Zhulong — 自研 Agent Web 应用(TypeScript)

> 烛照九幽，龙腾万化。
> 界面复刻 Claude Code 侧边功能区 + 对话交互；底层为完全自研的
> TypeScript + Node.js 工程体系，不依赖任何开源 Agent 框架。

## 命名与文化内核

本项目以中国传统神话《山海经·大荒北经》的 **烛龙** 命名：

> 「有神，人面蛇身而赤，直目正乘。其瞑乃晦，其视乃明。……是烛九阴，是谓烛龙。」

**瞑乃晦，视乃明** —— 闭眼则天地幽暗，睁眼则光华普照。这正是智能体面对
混沌代码/任务的核心隐喻：未读未查之前一切皆黑箱，一经烛照则因果分明。

详见 [docs/naming-system.md](docs/naming-system.md) 与
[docs/system-prompts.md](docs/system-prompts.md)(专属「烛命」系统提示词)。

## 定位

可在浏览器里运行的自研 Agent 应用：左侧会话列表、中间对话流、工具块、
输入条 + 模式切换。后端把引擎决策与执行流式(SSE)推送到前端。

底层自研工程化：
- **权限层(server/src/engine/access)**：角色→能力授权，任意入口先过 guard。
- **流程管控(server/src/engine/pipeline)**：IDLE→VALIDATE→PLAN→EXECUTE→REVIEW→FINISH 不可逆状态机 + 审计轨迹。
- **写前读门禁(server/src/engine/loop)**：accept 模式才允许写，且目标必须先读/先见。
- **网关(server/src/gateway)**：自研 Express REST + SSE 实时流。
- **界面(web/)**：React(TSX) + Ant Design 组件库，暗色主题以烛焰橙 `#ff6b1a` 为主色。

## Quick Start

```bash
npm install        # 安装依赖(Node 24+)
npm run dev        # 同时启动后端 + 前端
# 前端 http://localhost:5173/  (API 代理到后端 8735)
# 后端 http://127.0.0.1:8735/api/health
```

生产构建与启动：

```bash
npm run build      # 后端 tsc + 前端 vite build
npm start          # node server/dist/index.js
```

## 目录

```
├── server/              # 后端(Node + Express + TS)
│   └── src/
│       ├── prompts.ts       # 烛命系统提示词
│       ├── engine/
│       │   ├── access.ts    # 角色/能力授权
│       │   ├── pipeline.ts  # 全链路阶段状态机
│       │   ├── tools.ts     # 自研工具注册表
│       │   ├── loop.ts      # 流式执行循环(SSE 事件源)
│       │   └── provider.ts  # 离线 Mock 引擎
│       ├── store/threads.ts # 会话存储
│       └── gateway/app.ts   # Express REST + SSE
├── web/                  # 前端(React + Vite + antd)
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       └── components/      # 会话列表/对话面板/输入条/烛命抽屉
├── docs/                # 命名体系 + 系统提示词
├── package.json          # workspaces 根
└── tsconfig.base.json
```

## 软件许可

MIT