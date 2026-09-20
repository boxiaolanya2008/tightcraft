import React, { useState } from "react";
import { Button, Input, Segmented, Space, Typography } from "antd";
import { SendOutlined } from "@ant-design/icons";
import type { Mode } from "../api";

interface Props {
  running: boolean;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onSend: (content: string) => void;
}

/** 输入条：textarea + 发送按钮 + normal/accept 模式切换。 */
export default function InputBar({ running, mode, onModeChange, onSend }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const v = value.trim();
    if (!v || running) return;
    onSend(v);
    setValue("");
  };

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid #262a38" }}>
      <Space.Compact style={{ width: "100%" }}>
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 6 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={running ? "烛龙正在睁目照察…" : "向烛龙下达任务（Enter 发送 / Shift+Enter 换行）"}
          disabled={running}
          style={{ resize: "none" }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={submit}
          loading={running}
          disabled={!value.trim()}
          style={{ background: "#ff6b1a", color: "#fff" }}
        >
          {running ? "运行中" : "发送"}
        </Button>
      </Space.Compact>

      <Space style={{ marginTop: 8, width: "100%", justifyContent: "space-between" }}>
        <Segmented<Mode>
          size="small"
          value={mode}
          onChange={(m) => onModeChange(m)}
          options={[
            { label: "normal", value: "normal" },
            { label: "accept", value: "accept" },
          ]}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {mode === "accept" ? "accept：允许在此模式落地写入(仍过写前读)" : "normal：拒绝一切写入"}
        </Typography.Text>
      </Space>
    </div>
  );
}