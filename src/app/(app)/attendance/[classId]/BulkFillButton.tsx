"use client";

// フォームの状態管理をせずに、指定したname接頭辞を持つ<select>をまとめて
// 特定の記号に設定するだけの軽量なボタン（「全員出席」一括ボタン）。
// AttendanceSymbolCellはReactの制御コンポーネントのため、単純に
// el.value を書き換えるだけではReact側のstate（時刻・理由欄の表示判定を含む）
// に反映されない。ネイティブのvalueセッター経由で値を設定した上でchange
// イベントを発火させ、Reactのイベントハンドラに正しく検知させる。
export default function BulkFillButton({
  namePrefix,
  symbolId,
  label,
}: {
  namePrefix: string;
  symbolId: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const nativeValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          "value",
        )?.set;
        document
          .querySelectorAll<HTMLSelectElement>(
            `select[name^="${namePrefix}"]`,
          )
          .forEach((el) => {
            nativeValueSetter?.call(el, symbolId);
            el.dispatchEvent(new Event("change", { bubbles: true }));
          });
      }}
      className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
    >
      {label}
    </button>
  );
}
