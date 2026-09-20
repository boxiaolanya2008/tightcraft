# agent-craft

自研 Agent 框架(纯 Python、零第三方依赖):执行循环 + 工具系统 + 规划器 + 指纹记忆 + 安全门禁。既有的 `modules/` 是行为规范文档，本目录是把规范落成能跑代码。

## 能干什么(实际可运行)

- **Agent 执行循环**:`plan -> act(工具) -> observe -> loop`，带 `max_steps` 护栏与失败恢复。
- **工具系统**:注册表 + 内置 `fs_read/fs_list/fs_write/sh_run`，可自定义扩展。
- **写前已读安全门禁**(自研差异点):`fs_write` 已存在文件必须先 `fs_read`；指纹过期则拒写，防覆盖未审计/已漂移文件。
- **记忆治理**:文件指纹锁存、失效作废。
- **规划器**:任务 → DAG 拆解 + 环/悬空检测 + 拓扑序。
- **在线决策**:`OpenAIProvider` 走 OpenAI 兼容端点函数调用(仅 urllib)。

## 快速验证(离线)

```bash
python3 -m pytest -q            # 14 个用例，无网络、无密钥
PYTHONPATH=src python3 -m agentcraft.cli run "写读演示"
```

## 在线使用

```bash
pip install -e .
agent-craft chat "<你的任务>" --api-key $OPENAI_API_KEY --model gpt-4o-mini
```

`--base-url` 可指向任意 OpenAI 兼容端点。

## 目录

```
src/agentcraft/
  agent.py     执行循环
  providers.py 决策抽象(OpenAI兼容 / Mock)
  tools.py     工具系统 + 写前已读门禁
  memory.py    指纹记忆
  planning.py  规划器(DAG)
  types.py     核心类型
  cli.py       命令行入口
tests/         离线测试(证明实际跑通)
docs/          架构说明
modules/       行为规范文档(能力定义)
```

## 安全提示

- OpenAI API Key 走环境变量，勿提交进仓库。
- `sh_run` 默认白名单只读命令；写文件有门禁。高权限使用需自行按 `root`/白名单收敛。