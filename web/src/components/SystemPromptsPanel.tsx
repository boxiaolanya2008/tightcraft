import React from "react";
import { Collapse, Drawer, Empty, Spin, Typography } from "antd";
import type { ZhulongPrompts } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  prompts: ZhulongPrompts | null;
  loading: boolean;
}

const SECTIONS: Array<{ key: keyof ZhulongPrompts; label: string }> = [
  { key: "maestro", label: "① 总纲 · 主 System Prompt" },
  { key: "decision", label: "② 工具调用 · Decision Prompt" },
  { key: "guard", label: "③ 守卫 · 权限 / 写前读" },
  { key: "review", label: "④ 总结 · Review / Final" },
];

/** 烛命面板：以 Drawer 展示 /api/prompts 返回的 4 段系统提示词。 */
export default function SystemPromptsPanel({ open, onClose, prompts, loading }: Props) {
  return (
    <Drawer
      title={
        <span>
          烛命 · 系统提示词 <Typography.Text type="secondary">(Ordinance of the Candle)</Typography.Text>
        </span>
      }
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
    >
      {loading ? (
        <div style={{ textAlign: "center", paddingTop: 80 }}>
          <Spin />
        </div>
      ) : prompts ? (
        <Collapse
          defaultActiveKey="maestro"
          items={SECTIONS.map((s) => ({
            key: s.key,
            label: <Typography.Text strong>{s.label}</Typography.Text>,
            children: (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "#d9dbe3",
                  background: "#11161f",
                  padding: 12,
                  borderRadius: 8,
                  margin: 0,
                }}
              >
                {prompts[s.key]}
              </pre>
            ),
          }))}
        />
      ) : (
        <Empty description="提示词加载失败" />
      )}
    </Drawer>
  );
}