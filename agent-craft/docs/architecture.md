# 架构说明 — agent-craft

零第三方依赖(仅标准库)的自研 Agent 框架。核心是**解耦的决策/执行**与**安全门禁**。

## 分层

```
cli.py           入口:run(离线演示) / chat(OpenAI兼容)
   └─ Agent       执行循环:plan->act->observe(护栏:max_steps)
        ├─ LLMProvider    "下一步做什么"(决策)
        │    ├─ OpenAIProvider  真实端点(urllib,函数调用)
        │    └─ MockProvider    离线可脚本化(测试/演示)
        ├─ Registry     "怎么做"(工具注册表 + schema)
        └─ Memory        "记什么"(指纹锁存,写门禁数据源)
```

## 执行循环(状态机)

```
任务 → decide → 是否 final?
        │否(工具调用)
        ├─ 校验/执行工具
        ├─ 记录 StepObservation(工具结果回填 history)
        ├─ 失败:门禁即停 / 一般错误有限重试(指数退避)
        └─ 回到 decide(护栏 max_steps 兜底)
```

关键性质:
- **决策与副作用彻底隔离**:Provider 只产出 `Decision`(final 或 ToolCall)，绝不直接碰文件/网络。
- **失败可恢复**:工具失败写回 history，Provider 下一轮据其换路径；安全门禁命中不给自动重试(高优先由模型决策)。
- **护栏防失控**:`max_steps` 到顶即止，返回累计成功/失败统计。

## 安全门禁(自研差异点)

- **写前已读(write-before-read)**:`fs_write` 对已存在文件，必须持有该文件当前指纹(经 `fs_read` 记录)才放行；无指纹或指纹过期(文件被外部改动)一律 `PermissionError`，`force=true` 才显式覆盖。机制上杜绝覆盖未审计/已漂移文件。
- **路径越界拒绝**:写工具把相对路径解析并钳制在 `root` 内，`..` 逃逸即拒绝。
- **受限 shell**:仅白名单只读命令，凡含 `|;&<>$()` 直接拒绝。
- **最小权限**:读是安全操作不设限；写与执行严格门禁。

## 记忆与上下文治理

`Memory` 维护 `path -> (指纹, 摘要)`。`reads()` 返回**活指纹表**，同时供：
- `fs_read` 记录指纹；
- `fs_write` 门禁校验(先读后写);
- 失效判定(文件变化→指纹变化→旧态作废)。

同一活表由 read/write 共享，保证"读过即能写、漂移即拒绝"跨工具一致。

## 规划器

`planning.decompose` 产出 `Plan(DAG)`；`topo_order` 做环/悬空检测并给出拓扑序；`execute_plan` 按序执行。规划与执行解耦，可在联网 Provider 的 `break_down` 中替换为模型拆解。

## Provider 契约

```python
class LLMProvider:
    def decide(self, task: str, history: list[StepObservation]) -> Decision: ...
```
- `Decision.final` → 停止并返回。
- `Decision.tool_call` → 执行并回填。

`OpenAIProvider` 将 history 编码为 `assistant`(tool_calls) + `tool` 消息，支持工具调用；`tools` schema 取自 `Registry.schema()`。异常在 `_safe_decide` 兜底，Provider 崩溃不击穿循环。

## 测试

`tests/` 全离线(无网络/无 LLM 密钥)：
- 端到端多步工具循环(写→读→收敛)
- 死循环护栏
- 规划 DAG 拓扑序 / 环 / 悬空
- 记忆指纹复用与失效
- 写前已读门禁(未读拒写 / 读后放行 / 陈旧读拒写)