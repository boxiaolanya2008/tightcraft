# claude-craft — 自研 Agent Web 应用

> 界面复刻 Claude Code 侧边功能区 + 对话交互；底层为完全自研工程体系，
> 不依赖任何开源 Agent 框架。复用本仓库先前自研的 `agentcraft` 引擎内核。

## 定位

一个可在浏览器里跑的自研 Agent 应用：左侧会话列表、中间对话流、工具块、
命令面板、输入条——操作方式与视觉辨识度对齐 Claude Code。后端把引擎的
决策与执行流式(SSE)推送到前端。

底层强调「编码规范 + 模块权限 + 全链路管控」的工程化：
- **craftcheck**：零依赖的代码格式/规范校验器，进 pre-commit/CI 门禁。
- **权限层(app/access)**：以角色为授权最小单元，任意入口执行前必过 guard。
- **流程管控(app/engine/pipeline)**：运行建模为不可逆阶段链 + 审计轨迹。
- **HTTP 网关(app/httpd)**：自研线程化网关 + SSE 实时流。

## Quick Start

```bash
# 依赖:python3(3.11+)。无第三方运行时依赖。

# 离线 Mock 演示(不要求 API Key)
python3 run.py

# 在线(任意 OpenAI 兼容服务)
python3 run.py --api-key $KEY --model gpt-4o-mini

# 打开
#   http://127.0.0.1:8731/
```

### 全链路校验

```bash
bash scripts/check.sh     # 自研规范校验 + 单元测试(22 项)
```

## 目录

```
claude-craft/
├── app/
│   ├── config.py      # 配置:模式/角色/护栏常量
│   ├── access.py      # 模块权限划分(角色→能力授权)
│   ├── httpd.py       # 自研线程化 HTTP 网关(JSON + SSE)
│   ├── state.py       # 会话存储
│   └── engine/
│       ├── events.py    # SSE 事件类型
│       ├── pipeline.py  # 全链路阶段状态机 + 审计
│       ├── loop.py      # 流式执行循环(决策/执行→SSE)
│       └── _bootstrap.py# 接入自研 agentcraft 引擎
├── web/               # 前端(index.html / styles.css / app.js)
├── scripts/check.sh   # 门禁:规范 + 测试
├── tests/             # 22 项单元/端到端测试
├── craftcheck.py      # 自研代码规范校验器
└── run.py             # 启动入口
```

## 架构

见 [docs/architecture.md](docs/architecture.md) 与各模块 docstring。

## 软件许可

MIT