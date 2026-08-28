"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast/ToastProvider";
import { isNextInternalError } from "@/lib/nextInternalError";

// 既存のServer Action（(formData) => Promise<void>、失敗時はthrow）を
// そのまま利用しつつ、保存成功/失敗をトースト通知で表示する共通フォーム。
//
// 保存成功後、画面に最新値を正しく反映させるまでの流れ：
// 1. Server Actionを実行（revalidatePath等によりサーバー側のキャッシュは
//    更新されるが、クライアント側の画面がその最新データで再描画される
//    タイミングは、action(formData)のPromiseが解決した時点で必ずしも
//    確定していない）。
// 2. router.refresh()をstartTransitionで包んで呼び出し、そのisPendingが
//    falseに戻る（＝最新データでの再描画が実際に反映された）のを待つ。
// 3. isPendingがfalseになってから、フォームをkeyで再マウントし、
//    サーバーから再取得された最新値（defaultValue）が正しく画面に
//    反映されるようにする（React 19はServer Action成功時に
//    uncontrolledフィールドを自動リセットするが、defaultValueは
//    初回マウント時にしか反映されないため、再マウントしないと
//    保存直後の表示が古い初期値に戻って見えてしまう）。
//    2を待たずに再マウントすると、再マウント時点でまだ親コンポーネント
//    のpropsが古いままのことがあり、結果として保存直後は変更前の値が
//    表示され続け、別ページから戻ってきて初めて最新値に変わる、
//    という不具合が起きる。
//
// ただし、この再マウントは諸刃の剣でもある：子コンポーネントが
// useState(props.defaultXxx) のような形で自前の状態を持つ「制御された」
// 入力を実装している場合（例：AttendanceSymbolCell）、その状態は
// ユーザーの操作と保存結果を正しく反映済みであり、再マウントすると
// かえって親から渡されるprops（サーバーの最新データが反映された後でも、
// ユーザーが今まさに入力していた値とは無関係）で初期化し直されてしまう。
// そのような画面では remountOnSuccess={false} を指定し、この再マウントを
// 無効にすること。
export default function SubmitForm({
  action,
  successMessage = "保存しました",
  children,
  className,
  id,
  encType,
  remountOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<void>;
  successMessage?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  encType?: string;
  remountOnSuccess?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [isRefreshing, startRefresh] = useTransition();
  const [awaitingRemount, setAwaitingRemount] = useState(false);

  useEffect(() => {
    if (!awaitingRemount || isRefreshing) return;
    // router.refresh()（startRefreshで包んで発行）が完了し、親コンポーネントの
    // propsが最新化されたタイミングを検知して初めてフォームを再マウントしたい。
    // これは「外部の非同期処理（トランジション）の完了を購読して反応する」
    // という正当なエフェクトの用途であり、render中には計算できない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormKey((k) => k + 1);
    setAwaitingRemount(false);
  }, [awaitingRemount, isRefreshing]);

  async function handleAction(formData: FormData) {
    try {
      await action(formData);
      toast.success(successMessage);
      if (remountOnSuccess) {
        setAwaitingRemount(true);
        startRefresh(() => {
          router.refresh();
        });
      }
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
