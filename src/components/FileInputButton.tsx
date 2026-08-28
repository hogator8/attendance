"use client";

import { useId, useState } from "react";
import { buttonSecondaryClass } from "@/lib/ui";

// ネイティブの<input type="file">の見た目をブラウザ標準のものから
// 通常ボタンと同じデザインに揃えるためのラッパー。
export default function FileInputButton({
  name,
  accept,
  label = "ファイルを選択",
}: {
  name: string;
  accept?: string;
  label?: string;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={`${buttonSecondaryClass} cursor-pointer`}>
        {label}
      </label>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? null)}
      />
      <span className="text-xs text-slate-500">
        {fileName ?? "選択されていません"}
      </span>
    </div>
  );
}
