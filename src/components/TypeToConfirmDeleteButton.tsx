"use client";

import { useState } from "react";
import { useToast } from "./toast/ToastProvider";
import { isNextInternalError } from "@/lib/nextInternalError";

// 学生の完全削除など、特に取り返しのつかない操作向けの確認UI。
// 単純なconfirm()ダイアログではなく、指定した文字列（学籍番号等）と
// 完全に一致する入力があった場合のみ削除を実行できるようにする。
export default function TypeToConfirmDeleteButton({
  action,
  hiddenFields,
  confirmText,
  confirmLabel,
  successMessage,
  buttonLabel,
  buttonClassName,
}: {
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
  confirmText: string;
  confirmLabel: string;
  successMessage: string;
  buttonLabel: string;
  buttonClassName?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const formData = new FormData();
    for (const [key, value] of Object.entries(hiddenFields)) {
      formData.set(key, value);
    }
    try {
      await action(formData);
      toast.success(successMessage);
      setOpen(false);
      setInput("");
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-3">
      <p className="text-xs text-red-700">{confirmLabel}</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="rounded-md border border-red-300 px-2 py-1 text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={input !== confirmText || pending}
          onClick={handleDelete}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          完全に削除する
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setInput("");
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
