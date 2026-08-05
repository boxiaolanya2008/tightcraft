# 界面设计模块 — 无AI味、现代、沉淀化

## Boundary 硬边界

- 结构层级 ≤ 4 层;不堆 `<div>`。
- 视觉产出遵循下节规范,非模板化拼凑。
- 每屏只传达一个焦点动作;不靠堆组件充数。

## Teaching 规范

### 1. 语义化极简结构 (HTML)
- 用 `<header>/<main>/<section>/<article>/<nav>` 表达骨架,禁止滥用 `<div>`。
- 语义标签随内容载义;无用包裹即删。表单用 `<label>/<fieldset>/<legend>`。

### 2. 现代布局引擎 (CSS)
- 主布局用 **CSS Grid**,局部对齐用 Flexbox。
- 颜色、间距、圆角、字号全部定义为 **CSS 自定义变量**,主题一处改全站更。

### 3. 间距与字号体系
- 用**比例刻度**(4/8/12/16/24…)而非随意数值,保证视觉节奏。
- 字号用流式单位或字号比例,规范层级(H1→H3 清晰降级)。
- 留白即设计:压缩信息密度,给呼吸间距。

### 4. 硬件加速动效
- 动画只用 `transform`/`opacity`(GPU),严禁 `margin/left/top` 驱动。
- 过渡加 `transition`,拒绝生硬跳变;时长克制(.15–.3s)。

### 5. 系统主题跟随 + 可访问性
- 深浅色**只用** `@media (prefers-color-scheme)` 自适应;深色不硬编码哈希。
- 对比度达标;焦点态清晰;动效尊重 `prefers-reduced-motion`。
- 视觉元素有文字/aria 兜底,键盘可达。

### 6. 表单/交互最佳实践
- 标签外置而非仅占位;错误就地提示 + 明确修复方向。
- 状态可见:加载、空、错误、成功有区分语义。
- 空态给方向:无数据时引导下一步,而非裸空白。

### 7. 移动端 (Jetpack Compose / Native)
- 全面 Compose,弃 XML;MVVM/MVI 单向数据流,状态走 `StateFlow`。
- 深色与动态取色:`dynamicColorScheme` + `isSystemInDarkTheme()`。
- 动画用 `animateContentSize()`/`AnimatedVisibility`/`Animatable`,拒 `setVisibility` 生硬切换。

## Antipatterns 界面AI味(源头规避)

| 坏味道 | 反制 |
|---|---|
| div 海洋无语义 | 语义标签表达骨架 |
| 套 UI 库模板 | 语义适配 + 自研核心交互 |
| 动效每块都动 | 克制,只保留引导性动效 |
| 主题色硬编码 | CSS 变量 + 系统跟随 |
| 平方而死的组件 | 变化间距层级与形状节奏 |
| 三层阴影 + 渐变堆叠 | 单光源、低饱和、微对比 |
| 一切居中金玉 | 用 12 列网格对齐,而非无脑居中 |
| 空态裸白 | 空态给引导文案与动作 |

## AI 视觉叙事识别与反制(强制)

这是 AI 生成界面最典型的一整套"招牌戏法"。识别并逐项反制,否则一眼可辨是 AI 产物。

| AI 味视觉叙事 | 识别信号 | 反制(功能驱动) |
|---|---|---|
| 深邃科技感基调 | 全局深底 `#0a0a12` + 动态网格 + 浮动发光粒子,模拟"数据流/数字空间" | 颜色交给语义与系统主题;网格/粒子承载信息时才保留(真数据图),否则删。不靠装饰假装"未来" |
| 神经网络可视化 | 右侧画布浮动节点 + 动态连线 + 沿连线移动光点,隐喻"AI 思考" | 只有真模型拓扑/依赖图才允许;纯装饰的"AI 脑"悬浮尽量删。隐喻挡路即移除 |
| 霓虹渐变与光晕 | 紫→青渐变(按钮/Logo/标题) + 大量 `box-shadow`/`text-shadow` 外发光 | 单一主色 + 一个强调色;发光只用于真实焦点态(如高亮当前项)。渐变 ≤1 处 |
| 毛玻璃卡片(glassmorphism) | `backdrop-filter: blur` 大范围铺在导航/卡片上 | 只对遮挡层/浮层用;正文卡片用不透明底保可读性。blur 使性能与可读性双降 |
| 悬浮发光/上浮/阴影扩散 | 悬停即边框发光 + 上浮 + 阴影扩散 | 悬停只给 1 种明确反馈(状态/缩放或颜色);不给三重反馈叠加 |
| 呼吸光效 Logo | Logo/品牌元素持续脉动发光 | 极简静态 Logo;动画只服务"正在发生"的语义,不点缀静态品牌 |
| 光泽扫过按钮 | 按钮上有渐变扫掠高光横穿 | 移除;按钮靠状态(active/hover/disabled)表达,不靠闪条 |
| 打字机关键词轮换 | 标题处打字机逐字切换关键词 | 静态标题或标准过渡切换;打字机只用于真实终端回显需求 |
| 脉冲指示点 | 卡片上灰色圆点缓慢脉冲表示"活跃/进行中" | 指示点=状态色(实心绿=在线,灰=离线),禁用无意义脉动;要动就用 `prefers-reduced-motion` 关闭 |

### 判定硬规则

1. **装饰服务于信息** — 任何发光/动效/渐变问一句:删掉后信息损失吗?不损失 → 删。
2. **一处一点缀** — 全页只允许 ≤1 个非承载信息的装饰动效,其余全部功能驱动。
3. **真数据才可视化** — 连线/粒子/节点只在映真实关系时允许;真实感优先于氛围感。
4. **性能与可读性优先** — `backdrop-filter`/`box-shadow` 滥用削可读性与帧率;用前深思。
5. **遵守 `prefers-reduced-motion`** — 所有动效用户偏好减动时自动降级/关闭。

### Good Example(留信息、去装饰)

```css
/* 状态点:色语义,不脉动 */
.status { width:.6rem; height:.6rem; border-radius:50%; }
.status--on { background:#22c55e; }
.status--off { background:#9ca3af; }
```
按钮悬停只改 1 态,不叠发光/上浮/扩散。

## Good Example

```html
<article>
  <h2>仪表</h2>
  <section class="grid">
    <p class="stat">载入</p>
    <p class="stat">错误</p>
  </section>
</article>
```
```css
:root { --bg:#fff; --gap:1rem; --radius:8px; --col:#222 }
@media (prefers-color-scheme: dark){ :root{ --bg:#111; --col:#eee } }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:var(--gap) }
.stat { border-radius:var(--radius); padding:1rem; background:color-mix(in srgb, var(--bg), var(--col) 8%) }
```

## Bad Example

- 深底 `#0a0a12` 全局网格 + 浮动粒子;右侧神经网络画布动态连线;标题/Logo/按钮满铺紫→青渐变 + 双侧外发光;每张卡片 `backdrop-filter: blur`;悬停同时边框发光 + 上浮 + 阴影扩散;Logo 呼吸脉动;按钮光泽扫过;标题打字机轮换;状态点集体脉冲 —— 整页装饰叠满,信息密度低、性能差、一眼 AI。

## 真实案例审计:deepseek_html(逐项对照)

来源:`deepseek_html_20260805_0e7b23.html`。这是 AI 生成页面的完整标本。下面**逐行审计其 AI 味**,形成可复用的识别清单。审查新界面时逐项比对。

| # | 文件位置 | AI 味语法/实现 | 识别信号 | 反制(去味) |
|---|---|---|---|---|
| 1 | `--bg-deep:#0a0a12` 全站深底 + `grid-bg` 动态网格 | 深色 + 线性网格 `mask-image` 圆形渐隐 | 装饰性"数据空间" | 删网格层;背景走系统主题 |
| 2 | `.particles-layer` + 55 个随机粒子 `floatUp` | JS 生成随机粒子+发光+上浮动画 | 纯装饰动效 | 删；要氛围用静态渐变背景即可 |
| 3 | `.navbar` `backdrop-filter:blur(24px)` + `::after` scanLine 扫光线 | 导航全毛玻璃+扫光线循环动画 | blur 滥用+装饰动效 | 导航用不透明底；删扫光线 |
| 4 | `.nav-logo-icon` `conic-gradient` 四色 + `logoPulse` 呼吸 + 双 box-shadow 发光 + 六边形 drop-shadow | Logo 多色锥形渐变+持续脉动+外发光 | 呼吸发光 Logo | 静态单色 Logo;发光去掉 |
| 5 | `.brand-text-gradient` 三色文字渐变 | 品牌名线性三色 `background-clip:text` | 渐变商标文字 | 单一主色文字 |
| 6 | `.nav-links li.active::after` 下划线 + 双 box-shadow 发光 | 激活项发光下划线 | 发光状态指示 | 实心色下划线,不发光 |
| 7 | `.nav-cta::before` + `@keyframes shimmer` 光泽扫过 | 按钮渐变高光横穿扫掠 | 光泽扫过按钮 | 删;靠状态表达 |
| 8 | `.hero-gradient-text` + `gradientShift` + `background-position` 动画 | 标题大段多色渐变并持续移动 | 渐变流动标题 | 静态标题,单色或至多一次静态渐变 |
| 9 | `.badge` `backdrop-filter:blur(8px)` + `.dot` `dotBlink` 脉冲 | 徽章毛玻璃+状态点持续脉冲 | 无意义脉冲 | 状态点实心色,不脉动 |
| 10 | `.btn-primary` 渐变 + 双侧外阴影 + hover 上浮 | 主按钮多色渐变+双层发光+悬停位移 | 霓虹渐变按钮+三重反馈 | 单主色按钮;hover 仅 1 种变化 |
| 11 | `.stat-card` blur + `::before` 右上光斑渐变 + `.stat-value` 渐变数字 | 统计卡毛玻璃+角部光斑+数字渐变 | 装饰光斑+渐变数字 | 不透明卡;数字纯色 |
| 12 | `.feature-card` blur + `.card-glow-dot` 脉冲 + hover 发光上浮 | 功能卡毛玻璃+脉冲点+悬停三重反馈 | 同上系统性叠加 | 卡实底;去脉冲点;hover 单反馈 |
| 13 | `.cta-banner` 三色渐变 + blur + `::after` 径向光斑 | 底部横幅多层渐变+毛玻璃+光斑 | 视觉堆叠 | 单色块 + 一句文案 |
| 14 | `.typewriter-cursor` 闪烁 + JS 打字机轮换 7 词 | 循环打字/删除关键词 | 打字机装饰 | 静态文案;打字机仅供真实终端 |
| 15 | `<div class="grid-bg">`,`<div class="particles-layer">` 两层全屏固定 | 全屏双层装饰固定层 | 装饰性 DOM 层 | 全部删除或改为单一静态背景 |
| 16 | 导航/按钮/徽章/图标/CTA 大量 emoji(`🚀✨📖🌐🧩💬…`) | 用 emoji 当图标 | emoji 当图形资产 | 用真实图标(内联 SVG)/矢量,或删图标 |
| 17 | `.neural-canvas` + JS 节点浮动 / 连线脉冲 / 流动粒子 / `NEURAL TOPOLOGY·LIVE` | 神经网络 Canvas + 数据流动粒子动画+标语 | 装饰性"AI 脑"可视化 | 仅真实拓扑/图允许;纯隐喻删 |
| 18 | 几乎每张卡 hover:`border 发光 + box-shadow 扩散 + translateY` 三重同放 | 全局 hover 全部叠 3 效果 | 模板化悬停 | 全部收敛为单一明确反馈 |

### 审计小结(可复用开关)

若新界面命中以下任一条即打回重做,直到镜检通过:

1. 有没有占位 emoji 当图标?→ 只有 `<img>/<svg>` 图标或纯文本才算数。
2. 有没有纯装饰的 JS 生成动画(随机元素/流动粒子/神经网络)承载真实数据?→ 删。
3. 有没有三处以上 `backdrop-filter: blur`?→ 收敛到 ≤1 处遮挡层。
4. 有没有同一个 hover 同时发光+上浮+阴影?→ 保留 1 种。
5. 有没有持续循环的装饰动画(呼吸/扫光/打字机/脉冲)撑起"智能感"?→ 信息承载者保留,其余删。
6. 有没有三色以上渐变文字/按钮堆叠出"科技感"?→ 减到 1 个主色 + 至多 1 处静态强调。

