import React, { useEffect, useState } from "react";
import { theme } from "antd";
import { Button, Empty, List, Tooltip } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import type { ThreadSummary } from "../api";

interface Props {
  threads: ThreadSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenPrompts: () => void;
}

/** 左侧会话列表：「+ 新对话」按钮 + 明烛(会话)列表 + 打开烛命面板入口。 */
export default function ConversationList({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenPrompts,
}: Props) {
  const { token } = theme.useToken();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#ff6b1a" }}>
          烛龙 Zhulong
        </div>
        <Button
          type="primary"
          block
          icon={<PlusOutlined />}
          onClick={onNew}
          style={{ background: "#ff6b1a" }}
        >
          新对话
        </Button>
        <Button
          block
          style={{ marginTop: 8 }}
          icon={<FolderOpenOutlined />}
          onClick={onOpenPrompts}
        >
          烛命·系统提示词
        </Button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }} className="zl-scroll">
        {ready && threads.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="尚无明烛(会话)"
            style={{ marginTop: 24 }}
          />
        ) : (
          <List
            size="small"
            dataSource={threads}
            renderItem={(t) => {
              const active = t.id === activeId;
              return (
                <List.Item
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 8,
                    padding: "6px 8px",
                    background: active ? token.colorPrimaryBg : "transparent",
                    border: `1px solid ${active ? "#ff6b1a55" : "transparent"}`,
                    marginBottom: 4,
                  }}
                  actions={[
                    <Tooltip key="del" title="删除">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(t.id);
                        }}
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<MessageOutlined style={{ color: "#ff6b1a" }} />}
                    title={
                      <span style={{ fontSize: 13, color: active ? "#fff" : token.colorText }}>
                        {t.title}
                      </span>
                    }
                    description={<span style={{ fontSize: 12 }}>{t.messageCount} 条消息</span>}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}