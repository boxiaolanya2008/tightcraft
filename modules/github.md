# GitHub 仓库规范模块 — 开源工程化全链路
# 适用:创建/重构一个可在 GitHub 上得到高星、可维护的仓库。从目录骨架到发布 release 的一整套交付标准。

## Boundary 硬边界

- **一次只交付一个可发布版本**:主干默认面向下一个 Minor 增量,禁止堆大杂烩。
- **文档先行,代码在后**:公开 API 未在 README 声明前,不视为完成。
- **任何对外物(包名/CLI 名/repo 名/徽章 URL)唯一且可变可控**,不符即改一次到位。
- **面向 Semantic Release 的可编程化**:版本号、CHANGELOG、tag 都应由工具或约定生成,不靠手改。

## Teaching 全链路清单

### 1. 仓库目录骨架(必生成)

```
<repo>/
├── src/                 # 源码(语言包名/模块归整到此处)
├── tests/               # 与源码一一对应的测试;禁止只见源码不见测试
├── docs/                # 长文档:API 参考、架构、迁移说明
├── .github/
│   ├── ISSUE_TEMPLATE/  # bug 报告 + 功能请求 模板
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/       # CI(测试)、Release(发版)、Lint
├── .gitignore           # 必含,排除产物/密钥/依赖锁(视语言)
├── LICENSE              # 必含;声明许可证,否则"不可用"
├── CONTRIBUTING.md      # 必含;贡献指引
├── CHANGELOG.md         # 必含;Keep a Changelog 风格
├── README.md            # 门面,见下
└── SECURITY.md(可选)    # 漏洞报告通道
```

### 2. LICENSE(先于一切)

- 统一在仓库根放一个许可文件;不写则默认保留所有权利 → 开源失败。
- 推荐语种:GitHub 高星项目多用 `MIT`(宽松)/ `Apache-2.0`(含专利授权)。非库/教程项目也需声明。
- 版权行含年份与持有者;LICENSE 内容取自 SPDX 原文,不手写简介替代。

### 3. README.md(门面,决定首印象)

必需区块,顺序固定:

| 区块 | 内容要求 |
|---|---|
| 标题 | 一行项目名 + 一句定位 |
| 徽章 | 版本 / CI / 覆盖率 / 许可证;徽章 URL 只能用 shields.io 与官方 status(不臆造) |
| Quick Start | 3 步内可跑:安装 → 最小示例 → 运行结果 |
| API 说明 | 公开函数/CLI 签名 + 契约;示例必须可执行 |
| 特性 | 少而真,不堆形容词 |
| 文档链接 / 许可证 / 贡献 | 指向 docs/、CONTRIBUTING.md、LICENSE |

### 4. 文档编写规范(docs/ 正确姿势)

高星仓库的文档不只是"能读",而是 **帮读者在 30 秒内定位、在 5 分钟内用起来**。这里规定 docs/ 下的文档怎么写才正确。

#### 4.1 文档目录组织(按读者分流)

- `README.md` = 门面(见上节),只放"这是啥 + 怎么快速跑"。
- `docs/` = 深度资料,按读者分流到独立文件,禁止全塞进一个长 README:
  - `installation.md` 安装 / `quickstart.md` 快速上手(可选,若 README 够用可不建)。
  - `api-reference.md` API 参考:每个公开对象一行签名 + 参数表 + 返值。
  - `guide.md` / `tutorials/` 指南与教程:带可复现步骤。
  - `architecture.md` 架构说明:仅当项目存在非平凡结构时才必要。
  - `migration.md` 迁移指南:每次破坏性变更都要更新(见 SemVer)。

#### 4.2 文档结构规范(每篇)

- 开头一篇一主题:标题 + 一句承上启下,交代"此文解决什么 / 阅读前提"。
- 用 `##` 分节,Mermaid 图仅在描述真实现流程时用(见 `ui` 去 AI 味)。
- 代码块带语言标识符与注释,且**必须真实可执行**——复制即可跑,禁伪代码占位。
- 表格式承载参数/返回值;步骤流程用有序列表;命令用独立代码块。

#### 4.3 内容写法规范(去 AI 味、去废话)

- 只写"怎么办",不写"这东西多么好"的形容词与口号。
- 一个观念一个断言,不堆并列类比;能直接给示例就 `示例`。
- 文档与代码同步:改了签名/路径/参数,必须同步改 docs,否则视为未完成。
- 所有路径/命令/链接可验证:指向真实文件与真实版本,不许占位占号。

#### 4.4 版本化文档

- 破坏性变更发布时,`docs` 里该 API 的章节加 `### 自 vX.Y 起` 标注,或另开 `migration.md`。
- `docs/` 的改动按普通 Conventional Commits 提交流入仓库,随版本发布。

### 5. 语义化版本控制(SemVer)

- 版本号 `MAJOR.MINOR.PATCH`。
  - **MAJOR**:破坏性 API 变更。
  - **MINOR**:向后兼容的新功能。
  - **PATCH**:向后兼容的 bug 修复。
- 每次发布前做一次"是否破坏向后兼容"检查:是 → 升 MAJOR;否 → 按功能/修复选 MINOR/PATCH。
- `0.x` 视为不稳定,主接口可动;进入 `1.0` 即承诺稳定契约。

### 6. Conventional Commits(驱动版本号 & CHANGELOG)

```
<type>(<scope>): <subject>
```

- `feat` → MINOR；`fix` → PATCH；`<type>!` 或 `BREAKING CHANGE:` 脚注 → MAJOR。
- 类型白名单:`feat fix docs style refactor perf test build ci chore revert`。
- 每次提交原子化、单一意图(见 `tasks/commit` 去 AI 味)。

### 7. CHANGELOG.md(Keep a Changelog)

- 顶部 `## [Unreleased]` 供新提交累积；发版时把累积转入带版本号的 `## [1.2.0] - 2026-08-05`。
- 分类:`Added / Changed / Deprecated / Removed / Fixed / Security`。
- 只写用户可见的变更,内部重构不整段罗列。

### 8. 测试体系(CI 的质检)

- "核心路径必有测试"为下限:至少覆盖主 happy path + 关键错误路径。
- 测试框架选源码语言的既有标准(不引入第二个测试框架)。
- CI 工作流(GitHub Actions)负责:每一 PR 跑测试;失败即红,不放行。

### 9. Package 发布(制作 package 并上传)

- **包管理器差异化**:
  - Node/Python/Java 等 → 用生态官方发布工具(`npm publish`、`hatchling/pip`、`pub publish`)。
  - 通用做法:先 `build` 出 Artifact,再发布;发布前 `npm pack`/`pip wheel`/等 dry-run 校验内容。
- **发布前 checklist**:
  1. `package.json`(或等价元数据)字段齐全:`name`/`version`/`license`/`repository`。
  2. files/include 清单正确,产物不含源码密钥与无关文件。
  3. 版本号与 CHANGELOG 当前版本一致。
  4. 密钥/令牌不入包、不落日志。
- 发布到私有源或需鉴权的源:CI 中用隐性命名的 Secret,不硬编码。

### 10. Release 上传(GitHub Release)

- **tag 与 Release 一一对应**:`git tag v<version>` 语义化,tag 必须匹配 `package.json`(或等价的 `pubspec.yaml`/`Cargo.toml`/`pyproject.toml`)版本。
- Release 正文从 CHANGELOG 抽取该版本的分类变更,不手写新副本。
- **Attach Assets**:把构建产物(二进制/tarball/source zip)上传到 Release,并保留"Source code"默认 zip(由 GitHub 自动生成)。
- CI 用 GitHub Actions Release 工作流:打 tag → 构建 → 附 asset → 发 Release。钩子 `workflow_dispatch`/`tag` 二选一,写明触发条件。

### 11. 目录/文件随仓库演进

- `docs/` 与源码同步演进;新增破坏性变更时,在 docs 标注迁移说明。
- 新特性需补 README 小节与示例,否则不算完成。

## Antipatterns 仓库发布坏味道(源头规避)

- **无 LICENSE** — 仓库"默认全版权",直接劝退贡献者。
- **README 无 Quick Start** — 用户 30 秒内不能跑 = 流失。
- **徽章 URL 臆造** — 链接不确定就给链接来源,不编一个。
- **版本靠手改不同步** — `package.json` 版本、tag、CHANGELOG 三者不一致。
- **破坏性变更忘升 MAJOR** — `1.1.0 → 1.2.0` 却改了主接口,破坏用户。
- **把密钥打进包/进仓库** — 一次泄露,永久清理困难。
- **Release 无 Attach Source / Asset** — 用户没法拿到可二进制产物。
- **提交信息空泛** — `update code`、`fix stuff`(见 commit 去 AI 味)。
- **无 CI** — 代码没被机器验证就发版。
- **文档与代码脱节** — 改签名/参数不更新 docs,读者照抄即错。
- **文档塞进长 README** — 深度资料全堆在门面,找不到入口。
- **伪代码占位** — 文档里的示例复制不能跑,占位符/省略号当完成。

## Good Example(节选)

```bash
# 1. 冻结契约:确认不破坏后,版本 1.2.0 → 下个破坏性变更 → 2.0.0
npm version minor -m "feat(cli): add export subcommand"
# 2. 构建并 dry-run 校验
npm pack --dry-run
# 3. 发布
npm publish
# 4. 打 tag(语义化,匹配 package.json)
git tag v1.2.0
# 5. Release 正文 = CHANGELOG 该版本段
gh release create v1.2.0 dist/build.zip --notes "见 CHANGELOG 2026-08-05"
```

```yaml
# .github/workflows/release.yml —— 触发条件:打 v* tag
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      - run: npm run build
      - run: gh release create "$GITHUB_REF_NAME" dist/* --generate-notes
        env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
```

## Bad Example

- 目录只有 `src` + 无 LICENSE、无 README Quick Start;徽章 URL 指向不存在的 CI;`package.json` 版本 `1.1.0` 而 tag `v2`,CHANGELOG 停在旧段;破坏性变更只升 PATCH;发布时把 `.env` 一并打成包上传;Release 只有自动 zip,无 Asset。
