"use client";

import { useState } from "react";
import { useToast } from "./toast/ToastProvider";
import { isNextInternalError } from "@/lib/nextInternalError";

// 既存のServer Action（(formData) => Promise<void>、失敗時はthrow）を
// そのまま利用しつつ、保存成功/失敗をトースト通知で表示する共通フォーム。
// 成功時はフォームをkeyで再マウントし、サーバーから再取得された最新値
// （defaultValue）が正しく画面に反映されるようにする
// （React 19はServer Action成功時にuncontrolledフィールドを自動リセットするが、
// defaultValueは初回マウント時にしか反映されないため、再マウントしないと
// 保存直後の表示が古い初期値に戻って見えてしまう）。
export default function SubmitForm({
  action,
  successMessage = "保存しました",
  children,
  className,
  id,
  encType,
}: {
  action: (formData: FormData) => Promise<void>;
  successMessage?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  encType?: string;
}) {
  const toast = useToast();
  const [formKey, setFormKey] = useState(0);

  async function handleAction(formData: FormData) {
    try {
      await action(formData);
      toast.success(successMessage);
      setFormKey((k) => k + 1);
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      toast.error(
        error instanceof Error ? error.message : "保存に失敗しました。",
      );
    }
  }

  return (
    <form
      key={formKey}
      id={id}
      action={handleAction}
      className={className}
      encType={encType}
    >
      {children}
    </form>
  );
}
