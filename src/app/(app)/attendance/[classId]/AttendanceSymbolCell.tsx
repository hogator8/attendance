"use client";

import { useState } from "react";
import { inputClass } from "@/lib/ui";

type SymbolOption = {
  id: string;
  symbol_char: string;
  category: string;
};

// 出席記号の選択欄。選択された記号のカテゴリに応じて、
// 時刻入力欄（遅刻・早退）・理由入力欄（出席・除外以外）を動的に表示する。
// 判定は symbol.category ベースで行い、特定の記号名はハードコードしない。
export default function AttendanceSymbolCell({
  symbolName,
  timeName,
  reasonName,
  symbols,
  defaultSymbolId,
  defaultTime,
  defaultReason,
}: {
  symbolName: string;
  timeName: string;
  reasonName: string;
  symbols: SymbolOption[];
  defaultSymbolId: string;
  defaultTime: string | null;
  defaultReason: string | null;
}) {
  const [symbolId, setSymbolId] = useState(defaultSymbolId);
  const selected = symbols.find((s) => s.id === symbolId);
  const showTime =
    selected?.category === "late" || selected?.category === "early_leave";
  const showReason =
    !!selected && selected.category !== "attendance" && selected.category !== "excluded";

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
      {showReason && (
        <input
          type="text"
          name={reasonName}
          defaultValue={defaultReason ?? ""}
          placeholder="理由（任意）"
          className={`${inputClass} w-36`}
        />
      )}
      {showTime && (
        <input
          type="time"
          name={timeName}
          defaultValue={defaultTime ?? ""}
          className={`${inputClass} w-28`}
        />
      )}
      <select
        name={symbolName}
        value={symbolId}
        onChange={(e) => setSymbolId(e.target.value)}
        className={inputClass}
      >
        <option value="">－</option>
        {symbols.map((s) => (
          <option key={s.id} value={s.id}>
            {s.symbol_char}
          </option>
        ))}
      </select>
    </div>
  );
}
