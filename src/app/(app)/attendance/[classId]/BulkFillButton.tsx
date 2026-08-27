"use client";

// フォームの状態管理をせずに、指定したname接頭辞を持つ<select>をまとめて
// 特定の記号に設定するだけの軽量なボタン（「全員出席」一括ボタン）。
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
        document
          .querySelectorAll<HTMLSelectElement>(
            `select[name^="${namePrefix}"]`,
          )
          .forEach((el) => {
            el.value = symbolId;
          });
      }}
      className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
    >
      {label}
    </button>
  );
}
