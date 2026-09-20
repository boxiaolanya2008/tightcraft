/* claude-craft 前端逻辑：会话、流式对话、工具块渲染、命令面板。零依赖。 */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  threads: [],
  activeId: null,
  mode: "normal",
  theme: "dark",
  running: false,
};

/* ---------------- 工具函数 ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function timeLabel(ts) {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function toolIcon(name) {
  const key = name.startsWith("fs_write") ? "edit"
    : name.startsWith("fs_read") ? "read"
    : name.startsWith("sh_run") ? "bash" : "misc";
  const glyph = name.startsWith("sh_run") ? ">_" : name.startsWith("fs_write") ? "✎" : "⮚";
  return { key, glyph };
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error((res.status) + " " + await res.text());
  return res.json();
}

/* ---------------- 会话侧栏 ---------------- */
function renderThreads() {
  const list = $("#threads");
  const q = ($("#search").value || "").toLowerCase();
  list.innerHTML = "";
  const filtered = state.threads.filter((t) => t.title.toLowerCase().includes(q));
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无对话</div>';
    return;
  }
  for (const t of filtered) {
    const item = document.createElement("div");
    item.className = "thread-item" + (t.id === state.activeId ? " active" : "");
    item.innerHTML = `
      <span class="t-dot"></span>
      <div class="t-body">
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-time">${timeLabel(t.created)}</div>
      </div>
      <button class="thread-del" title="删除" data-id="${t.id}">✕</button>`;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".thread-del")) return;
      openThread(t.id);
    });
    $(".thread-del", item).addEventListener("click", (ev) => {
      ev.stopPropagation();
      deleteThread(t.id);
    });
    list.appendChild(item);
  }
}

async function refreshThreads() {
  const { threads } = await api("/api/threads");
  state.threads = threads;
  renderThreads();
}

async function openThread(id) {
  state.activeId = id;
  const t = await api(`/api/threads/${id}`);
  renderThreads();
  $("#thread-title").textContent = t.title;
  renderMessages(t.messages || []);
}

async function newThread(firstTask) {
  const t = await api("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: firstTask || "" }),
  });
  state.activeId = t.id;
  await refreshThreads();
  openThread(t.id);
  if (firstTask) sendPrompt(firstTask);
}

async function deleteThread(id) {
  await api(`/api/threads/${id}`, { method: "DELETE" });
  if (state.activeId === id) {
    state.activeId = null;
    $("#thread-title").textContent = "新建对话";
    $("#messages").innerHTML = "";
  }
  await refreshThreads();
}

/* ---------------- 消息渲染 ---------------- */
function renderMessages(messages) {
  const box = $("#messages");
  box.innerHTML = "";
  if (!messages || messages.length === 0) {
    box.innerHTML = '<div class="empty-state">新建对话，描述你的任务。</div>';
    return;
  }
  for (const m of messages) appendMessage(m);
  scrollBottom();
}

function appendMessage(m) {
  const box = $("#messages");
  const row = document.createElement("div");
  row.className = "msg " + m.role;
  if (m.role === "tool") {
    box.appendChild(makeToolBlock(m.tool || "misc", m.content || "", m.ok));
    return;
  }
  row.innerHTML = `<div class="avatar">${m.role === "assistant" ? "C" : "U"}</div>
    <div class="assistant-body"><div class="assistant-text"></div></div>`;
  $(".assistant-text", row).textContent = m.content || "";
  box.appendChild(row);
}

function statusHtml(ok) {
  return ok === false
    ? '<span class="err">✕</span>'
    : ok === true
      ? '<span class="ok">✓</span>'
      : '<span class="dot">●</span>';
}

function makeToolBlock(toolName, output, ok) {
  const { key, glyph } = toolIcon(toolName);
  const wrap = document.createElement("div");
  wrap.className = "msg tool";
  wrap.innerHTML = `
    <div class="avatar"></div>
    <div class="assistant-body">
      <div class="tool-block">
        <div class="tool-head">
          <span class="tool-ico ${key}">${glyph}</span>
          <span class="tool-cmd"></span>
          <span class="tool-status">${statusHtml(ok)}</span>
          <span class="tool-caret">▾</span>
        </div>
        <div class="tool-out ${ok === false ? "err" : ""}"></div>
      </div>
    </div>`;
  $(".tool-cmd", wrap).textContent = toolName;
  const out = $(".tool-out", wrap);
  if (ok === true || ok === false) out.textContent = output || (ok ? "(空输出)" : "操作失败");
  $(".tool-head", wrap).addEventListener("click", () => {
    out.style.display = out.style.display === "none" ? "" : "none";
  });
  return wrap;
}

function scrollBottom() { const m = $("#messages"); m.scrollTop = m.scrollHeight; }

/* ---------------- 流式运行 (SSE) ---------------- */
async function sendPrompt(task) {
  if (state.running) return;
  const content = (task ?? $("#prompt").value).trim();
  if (!content) return;
  if (!state.activeId) { await newThread(content); return; }

  $("#prompt").value = "";
  setRunning(true);

  const box = $("#messages");
  // 用户消息
  appendMessage({ role: "user", content });
  // 助手容器
  const aRow = document.createElement("div");
  aRow.className = "msg assistant";
  aRow.innerHTML = '<div class="avatar">C</div><div class="assistant-body"><div class="assistant-text"></div></div>';
  const aText = $(".assistant-text", aRow);
  box.appendChild(aRow);
  scrollBottom();

  let typed = "";
  try {
    const res = await fetch(`/api/threads/${state.activeId}/run?`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: content, mode: state.mode }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleEvent(raw, aRow, aText, box);
      }
    }
    // 清理结尾光标
    $(".cursor", aRow)?.remove();
  } catch (err) {
    aText.innerHTML = `<span style="color:#e05c4e">出错了：${esc(err.message)}</span>`;
  } finally {
    setRunning(false);
    await refreshThreads();
  }
}

function handleEvent(raw, aRow, aText, box) {
  const [nameLine, dataLine] = raw.split("\n");
  const type = nameLine.split(": ")[1];
  let payload = {};
  if (dataLine) { try { payload = JSON.parse(dataLine.replace(/^data: /, "")); } catch {} }
  if (type === "text_delta") {
    aText.textContent += payload.text || "";
    aText.innerHTML += '<span class="cursor"></span>';
    ensureLastCursor(aText);
    scrollBottom();
  } else if (type === "tool_start") {
    const tb = makeToolBlock(payload.tool || "misc", "", null);
    tb.dataset.toolId = payload.id;
    tb.querySelector(".tool-out").classList.add("typing");
    box.appendChild(tb);
    scrollBottom();
  } else if (type === "tool_end") {
    const tb = box.querySelector(`[data-tool-id="${esc(payload.id)}"]`);
    if (tb) {
      const out = $(".tool-out", tb);
      out.textContent = payload.ok === false
        ? (payload.error || "操作失败")
        : (payload.output || "(空输出)");
      out.classList.remove("typing");
      if (payload.ok === false) out.classList.add("err");
      // 更新状态标记
      $(".tool-status", tb).innerHTML = statusHtml(payload.ok);
    }
  } else if (type === "done") {
    // 确保收起光标、保留最终文本
    aText.innerHTML = aText.textContent;
  } else if (type === "error") {
    aText.innerHTML = `<span style="color:#e05c4e">${esc(payload.message || "运行失败")}</span>`;
  }
}

function ensureLastCursor(el) {
  const cursors = $$(".cursor", el);
  while (cursors.length > 1) cursors.pop().remove();
}

function setRunning(v) {
  state.running = v;
  $("#btn-send").disabled = v || !$("#prompt").value.trim();
  $("#btn-send").textContent = v ? "◍" : "➤";
}
function inputChanged() { $("#btn-send").disabled = state.running || !$("#prompt").value.trim(); }

/* ---------------- 模式 / 主题 ---------------- */
function applyMode() {
  $("#btn-mode").textContent = "模式: " + state.mode;
  $("#btn-mode-mini").textContent = state.mode;
  $("#mode-badge").textContent = state.mode;
  $("#set-mode").value = state.mode;
}
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  $("#set-theme").value = state.theme;
}
function toggleMode() {
  state.mode = state.mode === "normal" ? "accept" : "normal";
  applyMode();
}
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
}

/* ---------------- 命令面板 ---------------- */
const COMMANDS = [
  { name: "新对话", key: "⌘N", run: () => { closePalette(); newThread(""); } },
  { name: `切换模式 → ${state.mode === "normal" ? "accept" : "normal"}`,
    key: "M", run: () => { toggleMode(); showPalette(); } },
  { name: "切换主题(深色/浅色)", key: "◐", run: () => { toggleTheme(); closePalette(); } },
  { name: "打开设置", key: "S", run: () => { closePalette(); $("#settings").classList.remove("hidden"); } },
];

function showPalette() {
  $("#palette").classList.remove("hidden");
  $("#palette-list").innerHTML = "";
  for (const c of COMMANDS) {
    const li = document.createElement("li");
    li.innerHTML = `${esc(c.name)}<small>${c.key}</small>`;
    li.addEventListener("click", c.run);
    $("#palette-list").appendChild(li);
  }
  const input = $("#palette-input");
  input.value = ""; input.focus();
  filterPalette();
}
function closePalette() { $("#palette").classList.add("hidden"); }
function filterPalette() {
  const q = ($("#palette-input").value || "").toLowerCase();
  $$("#palette-list li").forEach((li, i) => {
    li.style.display = li.textContent.toLowerCase().includes(q) ? "" : "none";
    li.classList.toggle("active", i === 0);
  });
}

/* ---------------- 事件绑定 ---------------- */
$("#btn-new").addEventListener("click", () => newThread(""));
$("#btn-send").addEventListener("click", () => sendPrompt());
$("#btn-mode").addEventListener("click", toggleMode);
$("#btn-mode-mini").addEventListener("click", toggleMode);
$("#btn-theme").addEventListener("click", toggleTheme);
$("#btn-palette").addEventListener("click", showPalette);
$("#btn-settings").addEventListener("click", () => $("#settings").classList.remove("hidden"));
$("#close-settings").addEventListener("click", () => $("#settings").classList.add("hidden"));
$("#btn-help").addEventListener("click", () => { COMMANDS[3].run(); });

$("#prompt").addEventListener("input", () => {
  inputChanged();
  $("#prompt").style.height = "auto";
  $("#prompt").style.height = Math.min($("#prompt").scrollHeight, 200) + "px";
});
$("#prompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
});
$("#search").addEventListener("input", renderThreads);
$("#set-mode").addEventListener("change", (e) => { state.mode = e.target.value; applyMode(); });
$("#set-theme").addEventListener("change", (e) => { state.theme = e.target.value; applyTheme(); });

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); showPalette(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); newThread(""); }
  if (e.key === "Escape") { closePalette(); $("#settings").classList.add("hidden"); }
});
$("#palette").addEventListener("click", (e) => { if (e.target === $("#palette")) closePalette(); });
$("#palette-input").addEventListener("input", filterPalette);

/* ---------------- 启动 ---------------- */
applyMode();
applyTheme();
refreshThreads();
