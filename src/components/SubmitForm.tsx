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
// なお、子コンポーネントが useState(props.defaultXxx) のような形で
// 自前の状態を持つ「制御された」入力を実装している場合（例：
// AttendanceSymbolCell）、一見すると「その状態はユーザーの操作と保存結果を
// 正しく反映済みだから再マウントは不要」と思えるが、それだけでは不十分な
// ケースがある。React 19は保存成功後、controlled/uncontrolledを問わず
// フォーム要素にネイティブの form.reset() を実行する。BulkFillButtonの
// ようにネイティブのvalueセッター経由でDOMを直接書き換えてchangeイベントを
// 発火させる形で値を設定した場合、Reactが内部的に保持する「DOMへ最後に
// 書き込んだ値」の記録が実際のDOM値とズレたままになることがあり、
// form.reset()でDOMの値が巻き戻った後、Reactが「既に正しい値のはず」と
// 誤認して再描画をスキップし、画面上は古い値が表示され続けてしまう
// （保存直後は一瞬正しい値が見え、その後の再描画で古い値に戻って見える）。
// この不具合は、remountOnSuccess={false}で再マウントを無効化しても
// 解消しない（form.reset()自体はReact側の再マウント制御と無関係に働くため）。
// 確実に直すには、このコンポーネントの再マウント機構を使い、確定的に
// 最新データを取得した後に子コンポーネントを作り直す（＝新しいDOM要素で
// useStateを最新値から再初期化する）必要がある。そのため、ネイティブの
// DOM操作で値を一括変更するような入力（BulkFillButton等）と組み合わせて
// 使うフォームでは、制御コンポーネントであっても remountOnSuccess を
// 明示的に false にしないこと。
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
