# 工具调用规范模块 — 写入保真 + Windows 命令执行

## Boundary 硬边界

- **写入前必读**:对任何文件执行 write/edit 前,先 Read 原文。
- **写入后校验**:完成写入后,重读目标文件,确认只有目标区域变化、未涉及代码零改动。
- **命令语法先行**:不确定命令在当前环境(shell)是否可执行时,先做语法判断,不盲目跑 → 避免报错重试烧 token。

## write 与 edit 写入保真法则

### 1. 写前快照(Snapshot)

- 任何 write/edit 前,先 Read 目标文件,记住其**既有作用域**。
- edit 的 `oldString` 必须来自真实读取,不得臆造上下文(臆造 → 匹配失败 → 重试烧 token)。

### 2. 全量写入(write)的保真

- write 是**整体替换**:必须把目标文件完整、原样重建,仅改变需要改的区域。
- 未涉及的段落、空行、注释、格式必须逐字节保留,不得"顺手格式化"。
- 只能替换将要改写的文件;绝不用 write 去覆盖别处。

### 3. 增量写入(edit)的保真

- edit 只变更 `oldString → newString` 命中的那一处;**不得**连带改动其他逻辑。
- 若 `oldString` 在文件中多处出现,提供足够上下文使其唯一,或用 `replaceAll` 前确认真需求。
- 改后立即 Read 复核:除目标外无多余变化。

### 4. 写后校验(Changeset Check)

- 写入完成后,重读文件对比改动目标:
  - 目标改动是否符合意图?
  - 未涉及代码是否被意外改动?有 → 立即还原为快照。
- 校验失败以还原为主,不继续叠加修复(避免二次污染)。

## Windows 命令执行协议(win32 / PowerShell 5.1)

### 环境认知

- 平台是 `win32`,默认 shell 为 **PowerShell 5.1**——它不是 POSIX shell。
- 先判定命令属性,再选执行方式:

| 命令性质 | 执行方式 |
|---|---|
| 纯 Windows / PowerShell cmdlet | 直接在本 shell 运行 |
| POSIX 风格管道/工具(ls,grep,find,sed,cat,`$()`…) | 不可盲跑 |
| 依赖 `cmd` 内部语义(如 `&&`、`set`、批处理) | 用 `cmd /c "<命令>"` |
| 不确定 | 先验证语法,再跑 |

### 语法记账(错一次 = 全量命令 token 再烧一次)

- 一次报错重试的代价 ≈ 该命令被完整调用的一轮 token。
- 因此命执行前置动作:
  - 用 `Test-Path`/`Get-ChildItem` 等原生 cmdlet 替代 POSIX 文件探测。
  - 路径含空格 → 一律对整路径加引号;不要在命令内用 `cd` 改路径(依赖工具会失败)。
  - 顺序依赖用 `;` 加条件判断(如 `cmd1; if ($?) { cmd2 }`),勿用 POSIX 的 `&&`(PowerShell 不支持)。
- 逃避陷阱:裸 `pip`/`poetry` 等可能未加 `python -m` 前缀;用 `python -m pip` 规避 PATH 解析。

### 优先 cmd /c 的情形

- 需要 `cmd.exe` 语义但不值得换整条逻辑时,用:
  ```
  cmd /c "type file.txt && set FLAG=1"
  ```
- 不强制全用 PowerShell;目标是**一次性执行成功**,而不是坚持某个 shell。

### 命令执行通用守则

1. 能 `Test-Path` 就 `Test-Path`,别靠命令报错来探测存在。
2. 用 PowerShell 原生 cmdlet 做文件/目录/进程操作,勿套 GNU 单行。
3. 多子命令链用 `;` + 状态判断,弃 `&&`,避免脆弱。
4. 长任务加合理 timeout,不复试失控。

## Antipatterns 工具调用坏味道

- **write 覆盖整文件还顺带删空行/改缩进/改格式** — 破坏未涉及代码。
- **edit 用臆造 oldString** — 匹配失败 → 反复重试。
- **POSIX 语法盲跑** — `&&`、`ls`、`grep`、`$()` 在 PowerShell 报错 → token 浪费。
- **裸 pip/poetry** — PATH 解析失败;应 `python -m`。
- **不预检就执行** — 用命令报错当探测工具。
- **写入后不校验** — 静默破坏了别处代码而不自知。

## Good Example

```powershell
# 写前:确认目标存在且读到原文
Test-Path -LiteralPath "config\env.js"
# 命令:PowerShell 原生 + 条件链
Get-Content -LiteralPath "config\env.js" -Raw
python -m pip install requests
# cmd 语义用调用操作符
& cmd /c "python -m pip install requests"
```

## Bad Example

- `write` 全量覆盖时删掉原文件所有注释并重排间距；
- `edit` 猜了一个不存在的 `oldString` 反复失败;
- 在 PowerShell 里盲跑 `ls`、`grep`、`&&`、`$()` 报错重试多次;
- 裸跑 `pip install …` 未加 `python -m`,PATH 找不到。
