import React, { useEffect, useRef } from "react";
import { Empty, Space, Tag, Typography } from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  UserOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import type { Message, Mode } from "../api";
import InputBar from "./InputBar";

export interface LiveTool {
  id: string;
  tool: string;
  status: "running" | "ok" | "error";
  note?: string;
  args?: Record<string, unknown>;
}

interface Props {
  thread: { id: string; title: string; messages: Message[] } | null;
  running: boolean;
  pendingUser: string | null;
  liveText: string;
  liveTools: LiveTool[];
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onSend: (content: string) => void;
}

function toolStatusIcon(status: "ok" | "error" | "running") {
  if (status === "ok") return <CheckCircleFilled style={{ color: "#52c41a" }} />;
  if (status === "error") return <CloseCircleFilled style={{ color: "#ff4d4f" }} />;
  return (
    <span
      style={{
        display: "inline-flex",
        fontSize: 12,
        lineHeight: 1,
        animation: "zlPulse 1s infinite",
      }}
    >
      ●
    </span>
  );
}

function ToolBlock({
  tool,
  status,
  note,
  args,
}: {
  tool: string;
  status: "running" | "ok" | "error";
  note?: string;
  args?: Record<string, unknown>;
}) {
  const argLine = args ? Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ") : "";
  return (
    <Space
      style={{
        display: "inline-flex",
        padding: "4px 8px",
        borderRadius: 6,
        background: "#11161f",
        border: "1px solid #2a2f3d",
        margin: "2px 0",
      }}
    >
      {toolStatusIcon(status)}
      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#e6e6df" }}>{tool}</span>
      {argLine && (
        <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: "monospace" }}>
          {argLine.slice(0, 80)}
        </Typography.Text>
      )}
      {status === "running" ? (
        <Tag color="orange" style={{ marginInlineEnd: 0 }}>
          执行中
        </Tag>
      ) : (
        <Tag color={status === "ok" ? "green" : "red"} style={{ marginInlineEnd: 0 }}>
          {status === "ok" ? "✓ ok" : "✕ error"}
        </Tag>
      )}
    </Space>
  );
}

/** 中间对话区：历史消息 + 进行中的工具块/文本 + 底部输入条。 */
export default function ChatPanel(props: Props) {
  const { thread, running, pendingUser, liveText, liveTools, mode, onModeChange, onSend } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread?.messages.length, liveText, liveTools.length, pendingUser]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={scrollRef} className="zl-scroll" style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
        {thread && thread.messages.length === 0 && !pendingUser && !running ? (
          <Empty
            style={{ marginTop: "20vh" }}
            description={<span style={{ color: "#8a8f9d" }}>暗昧未明，先观而察 — 向烛龙下达任务</span>}
          />
        ) : (
          (thread?.messages ?? [])
            .concat()
            .concat(
              pendingUser
                ? [{ id: "pending-user", role: "user", text: pendingUser, createdAt: Date.now(), tools: [] }]
                : [],
            )
            .map((m, i) => <MessageRow key={m.id || i} m={m} />)
        )}

        {/* 运行中的实时区域 */}
        {running && (
          <div style={{ marginTop: 12 }}>
            {liveTools.map((t) => (
              <div key={t.id} style={{ marginBottom: 4 }}>
                <ToolBlock tool={t.tool} status={t.status} note={t.note} args={t.args} />
              </div>
            ))}
            {liveText && (
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  color: "#d9dbe3",
                  borderLeft: "2px solid #ff6b1a",
                  paddingLeft: 12,
                  marginTop: 8,
                }}
              >
                {liveText}
                <span style={{ animation: "zlPulse 1s infinite", color: "#ff6b1a" }}>▍</span>
              </div>
            )}
          </div>
        )}
      </div>

      <InputBar running={running} mode={mode} onModeChange={onModeChange} onSend={onSend} />

      <style>{`
        @keyframes zlPulse { 0%,100% {opacity:1} 50% {opacity:.25} }
      `}</style>
    </div>
  );
}

function MessageRow({ m }: { m: Message & { __kind?: string } }) {
  const isUser = m.role === "user";
  const col = isUser ? "#20283a" : "#141922";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
      <div
        style={{
          maxWidth: "78%",
          background: col,
          border: `1px solid ${isUser ? "#2c3550" : "#232936"}`,
          borderRadius: 10,
          padding: "10px 14px",
          borderTopLeftRadius: isUser ? 10 : 2,
          borderTopRightRadius: isUser ? 2 : 10,
        }}
      >
        <Space style={{ marginBottom: 6 }}>
          {isUser ? <UserOutlined style={{ color: "#ff6b1a" }} /> : <RobotOutlined style={{ color: "#ff6b1a" }} />}
          <Typography.Text strong style={{ fontSize: 12 }}>
            {isUser ? "你" : "烛龙"}
          </Typography.Text>
        </Space>
        {m.tools && m.tools.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {m.tools.map((t, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <ToolBlock tool={t.tool} status={t.status} note={t.note} args={t.args} />
              </div>
            ))}
          </div>
        )}
        <div style={{ whiteSpace: "pre-wrap", fontSize: 14, wordBreak: "break-word" }}>{m.text}</div>
      </div>
    </div>
  );
}