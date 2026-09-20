import React, { useCallback, useEffect, useState } from "react";
import { App as AntdApp, Layout, Spin, Typography } from "antd";
import { api, type Message, type Mode, type ThreadSummary, type ZhulongPrompts } from "./api";
import ConversationList from "./components/ConversationList";
import ChatPanel, { type LiveTool } from "./components/ChatPanel";
import SystemPromptsPanel from "./components/SystemPromptsPanel";

const { Content, Sider } = Layout;

export default function App() {
  const { message } = AntdApp.useApp();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTitle, setActiveTitle] = useState("");

  const [running, setRunning] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [liveTools, setLiveTools] = useState<LiveTool[]>([]);
  const [mode, setMode] = useState<Mode>("normal");

  const [promptsOpen, setPromptsOpen] = useState(false);
  const [prompts, setPrompts] = useState<ZhulongPrompts | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);

  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await api.listThreads());
    } catch {
      message.error("无法加载会话列表，请确认后端已启动");
    }
  }, [message]);

  const loadThread = useCallback(async (id: string) => {
    const t = await api.getThread(id);
    setActiveId(id);
    setActiveTitle(t.title);
    setMessages(t.messages);
  }, []);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  const selectThread = async (id: string) => {
    if (running) return;
    try {
      await loadThread(id);
    } catch {
      message.error("加载会话失败");
    }
  };

  const newThread = async () => {
    if (running) return;
    try {
      const t = await api.createThread();
      await refreshThreads();
      setActiveId(t.id);
      setActiveTitle(t.title);
      setMessages([]);
    } catch {
      message.error("新建会话失败");
    }
  };

  const deleteThread = async (id: string) => {
    if (running) return;
    try {
      await api.deleteThread(id);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
        setActiveTitle("");
      }
      await refreshThreads();
    } catch {
      message.error("删除失败");
    }
  };

  const openPrompts = async () => {
    setPromptsOpen(true);
    if (!prompts) {
      setPromptsLoading(true);
      try {
        setPrompts(await api.getPrompts());
      } catch {
        message.error("提示词加载失败");
      } finally {
        setPromptsLoading(false);
      }
    }
  };

  const send = async (content: string) => {
    if (!activeId) {
      message.warning("请先新建或选择一个会话");
      return;
    }
    setRunning(true);
    setPendingUser(content);
    setLiveText("");
    setLiveTools([]);
    try {
      await api.runThread(activeId, content, mode, (ev) => {
        switch (ev.type) {
          case "tool_start":
            setLiveTools((prev) => [
              ...prev,
              { id: ev.payload.id, tool: ev.payload.tool, status: "running", args: ev.payload.args },
            ]);
            break;
          case "tool_end":
            setLiveTools((prev) =>
              prev.map((t) =>
                t.id === ev.payload.id
                  ? {
                      ...t,
                      status: ev.payload.ok ? "ok" : "error",
                      note: ev.payload.ok ? ev.payload.result : ev.payload.error,
                    }
                  : t,
              ),
            );
            break;
          case "text_delta":
            setLiveText((prev) => prev + ev.payload.text);
            break;
          case "error":
            message.error(ev.payload.message);
            break;
          case "done":
            /* 工具记录已随 assistant 消息落库，结束后统一重取。 */
            break;
        }
      });
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setRunning(false);
      setPendingUser(null);
      setLiveText("");
      setLiveTools([]);
      await refreshThreads();
      if (activeId) {
        try {
          await loadThread(activeId);
        } catch {
          /* ignore */
        }
      }
    }
  };

  const threadForPanel = activeId
    ? { id: activeId, title: activeTitle, messages }
    : null;

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider width={280} style={{ background: "#0d1322", borderRight: "1px solid #1c2130" }}>
        <ConversationList
          threads={threads}
          activeId={activeId}
          onSelect={selectThread}
          onNew={newThread}
          onDelete={deleteThread}
          onOpenPrompts={openPrompts}
        />
      </Sider>
      <Content style={{ background: "#0b1120", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid #1c2130",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography.Text strong style={{ fontSize: 14 }}>
            {activeTitle || "烛龙 · 章尾 Zhulong Web"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            烛照九幽，龙腾万化
          </Typography.Text>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {!threadForPanel ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
              <Spin tip="请选择与会话" />
            </div>
          ) : (
            <ChatPanel
              thread={threadForPanel}
              running={running}
              pendingUser={pendingUser}
              liveText={liveText}
              liveTools={liveTools}
              mode={mode}
              onModeChange={setMode}
              onSend={send}
            />
          )}
        </div>
      </Content>

      <SystemPromptsPanel
        open={promptsOpen}
        onClose={() => setPromptsOpen(false)}
        prompts={prompts}
        loading={promptsLoading}
      />
    </Layout>
  );
}