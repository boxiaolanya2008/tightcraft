# 架构说明

## 1. 总览

`claude-craft` 是复刻 Claude Code 交互的自研 Agent Web 应用。
界面层全自研(vanilla HTML/CSS/JS)，后端全自研(标准库 HTTP 服务)，
引擎内核复用本仓库自研的 `agentcraft`，无任何开源 Agent 框架依赖。

一次对话的运行链路:

```
用户输入
  → app/httpd(gateway.threads.write 授权)        # 模块权限
  → agentcraft.MockProvider / OpenAI Provider      # 自研引擎决策
  → pipeline.Workflow(validate→plan→execute→review→finish)  # 全链路管控
  → loop.AgentRunner 迭代(工具调用前 access.guard 校验)
  → SSE 事件流(tool_start / tool_end / text_delta / done)
  → 前端 app.js 增量渲染
```

## 2. 模块划分与权限

| 模块 | 角色 | 职责 |
|---|---|---|
| app/engine | `core` | 决策、规划、状态推进 |
| app/httpd | `gateway` | HTTP 路由、会话、SSE |
| app/state | `gateway` | 会话存储 |
| agentcraft.tools | `tool` | 工具注册与执行 |
| app/access | — | 授权守卫(不持有业务) |

`access.default_policy()` 生成能力→角色授权表；任意能力调用前必须
`access.guard(role, capability)`，非法即抛 `AccessDenied`。
测试 `tests/test_access.py` 验证「同角色放行、越权拒绝」。

## 3. 全链路流程管控(pipeline)

一次运行被建模为**不可逆阶段链**:

```
IDLE → VALIDATE → PLAN → EXECUTE → REVIEW → FINISH
```

- `Workflow.transition()` 只允许合法转移，非法抛 `IllegalTransition`(缺陷中断)。
- 每次转移写 `AuditEntry` 进审计轨迹，支持事后复盘。
- `run_pipeline()` 按固定阶段链推进，`run_step(stage)` 为阶段扩展点。

收益:运行路径可预期、可测试、可审计。

## 4. 写前读(write-before-read)门禁

`loop` 在 accept 模式允许落地写，但强约束 **写前已读**(目标文件必须先被引擎
读过/列出过)，否则拒绝。normal 模式直接拒绝一切写。`tests/test_loop.py`
覆盖三种模式。

## 5. 流式执行与 SSE

`AgentRunner.iter_run()` 是单生成器，把每次工具调用/文本增量即时产出为
`SSE` 事件帧；`httpd` 以 `text/event-stream` 推送给前端，`app.js` 据此
增量渲染工具块与文本光标。SSE 无定长，写毕 `close_connection=True`。

## 6. 编码规范门禁(craftcheck)

零第三方依赖的规范校验器，兼顾可读/可维护/稳定:

- `LEN`  行超长(按语言差异化上限: py 100 / js·html 120 / css 160)
- `WS`   行尾空白 / 制表符缩进
- `BARE` 裸异常吞怒(仅 python)
- `TO-DO` 遗留标记
- `EOF`  未以换行收尾

`scripts/check.sh` 串起来源校验 + `pytest`(22 项)作为发布门禁，
可挂 pre-commit / CI。