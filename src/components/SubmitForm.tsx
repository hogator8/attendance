"use client";

import { useState, useTransition } from "react";
import { useToast } from "./toast/ToastProvider";
import { isNextInternalError } from "@/lib/nextInternalError";

// 既存のServer Action（(formData) => Promise<void>、失敗時はthrow）を
// そのまま利用しつつ、保存成功/失敗をトースト通知で表示する共通フォーム。
//
// Server Actionをイベントハンドラから呼び出す場合はstartTransitionで
// 包む必要がある（Next.jsのドキュメント参照）。これを怠ると、
// revalidatePath()によるページの再取得・再描画が、このコンポーネントの
// 後続の状態更新（フォームの再マウント）より後に反映されることがあり、
// 結果として保存直後は変更前の値が表示され続け、別ページから戻ってきて
// 初めて最新値に変わる、という不具合が起きる。
//
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
  const [, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    startTransition(async () => {
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
    });
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
