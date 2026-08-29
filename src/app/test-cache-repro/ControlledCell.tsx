"use client";

import { useState } from "react";

// AttendanceSymbolCellと同じパターン：useState(defaultValue)で自前の状態を持つ
// 制御コンポーネント。
export default function ControlledCell({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      data-testid="controlled-input"
      name="value"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ border: "1px solid #ccc", padding: "4px" }}
    />
  );
}
