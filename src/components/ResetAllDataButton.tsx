"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast/ToastProvider";
import { isNextInternalError } from "@/lib/nextInternalError";
import { RESET_CONFIRM_TEXT } from "@/lib/resetConfirmText";

// 全データリセット（管理者専用・完全初期化）専用の3段階確認UI。
// (1) 警告文の表示 → (2) 確認文言の完全一致入力 → (3) 最終的なはい/いいえ
// の3段階すべてを経てから初めてServer Actionを実行する。
type Step = "closed" | "warning" | "type" | "final";

export default function ResetAllDataButton({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep("closed");
    setInput("");
  }

  function handleExecute() {
    const formData = new FormData();
    formData.set("confirm_text", input);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success("すべてのデータをリセットしました");
        reset();
        router.refresh();
      } catch (error) {
        if (isNextInternalError(error)) throw error;
        toast.error(error instanceof Error ? error.message : "リセットに失敗しました。");
        reset();
      }
    });
  }

  if (step === "closed") {
    return (
      <button
        type="button"
        onClick={() => setStep("warning")}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
      >
        全データをリセットする
      </button>
    );
  }

  if (step === "warning") {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-red-300 bg-red-50 p-4">
        <p className="text-sm font-bold text-red-800">
          この操作を実行すると、管理者（admin）アカウントを除く、このサイトに登録されている
          すべてのデータ（学期・クラス・時間割・学生（写真を含む）・出席記号設定・出席記録・
          学校行事・休業日・過去データ（CSV取り込み分）・証明書設定・admin以外の教員
          アカウント等）が完全に削除されます。
        </p>
        <p className="text-sm font-bold text-red-800">
          この操作は取り消すことができません。実行前に必要なデータのバックアップ・出力を
          済ませてください。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep("type")}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            内容を理解した上で続行する
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  if (step === "type") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-4">
        <p className="text-xs text-red-700">
          続行するには、下の欄に次の文言を一字一句そのまま入力してください。
        </p>
        <p className="rounded bg-white px-2 py-1.5 text-xs text-red-900">{RESET_CONFIRM_TEXT}</p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="rounded-md border border-red-300 px-2 py-1.5 text-sm"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={input !== RESET_CONFIRM_TEXT}
            onClick={() => setStep("final")}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            次へ
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  // step === "final"
  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-800">
        本当にすべてのデータをリセットしますか？この操作は取り消せません。
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleExecute}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "実行中…" : "はい"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={reset}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          いいえ
        </button>
      </div>
    </div>
  );
}
