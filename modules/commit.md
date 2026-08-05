# 提交规范模块(去 AI 味)— Commit 规则

## Boundary 硬边界

- 提交信息**一行主题 ≤ 50 字符**;可加≤3 行正文,每行 ≤72 字符。
- 主题用祈使句、单句:一个提交只做一件事。
- 不产出整段客套、解释性长文体、表情符号、装饰性分隔线。

## Conventional Commits 语义(去 AI 味基线)

```
<type>(<scope>): <subject>
```
- `type`(必修):`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- `scope`:可选的受影响模块,动词前不带冠词。
- `subject`:祈使、小写开头、不句点结尾。

示例:
- `feat(auth): add refresh token rotation`
- `fix(api): validate query before db call`
- `refactor(core): extract builder from config`
- `docs: clarify install steps`

## Teaching 好主题怎么写

1. **主语缺失** — 主题默认隐含实现主体,不写"we/我/本提交"。
2. **动词开头** — `add/remove/fix/refactor/merge/update`,忌 `doing`/`did` 时态。
3. **聚焦单一** — 一个提交解决一个问题;多改动拆多条。
4. **言出有据** — 正文说明"为什么"(动机),而非逐条复述改动(看 git diff 即可知)。

## Antipatterns 提交 AI 味(源头规避)

| 辣提交信息 | 问题 | 去味后 |
|---|---|---|
| `update code` | 空泛,无价值 | `fix(cache): invalidate on write` |
| `Fix some bugs and improve stuff` | 模糊复数 | 拆成具体条目 |
| `feat: 完成了很多功能……` | 长文+装饰 | 每功能一条 |
| `docs: update readme.md` | 零信息 | `docs: clarify install for py` |
| `update: 修改了 xxx 文件以便让用户能……(3行流程)` | 复述 diff | `fix(ui): show spinner on load` |
| `Merge branch 'x' into 'y'` | 默认合并信息 | 保留或重写为实际语义 |

## 正文写法

- **Why 优先于 What**:正文回答"为什么这么改",改动本身交给 diff。
- 空正文可接受;只要主题已说清。
- 禁:表情符号、上下分隔线、整点客套、复述小写列表。

## 提交前「去 AI 味」门禁

1. 主题 ≤50 字符、动词开头、单句?
2. 一眼可懂改了什么、不读 diff 也明白动机?
3. 无表情/装饰/客套/长文?
4. 一个提交只干一件事?
5. 若让资深维护者扫列表,能否秒识别本条作用?能 → 通过。
