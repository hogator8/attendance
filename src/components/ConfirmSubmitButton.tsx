"use client";

// 削除など取り消せない操作向けの、確認ダイアログ付き送信ボタン。
// クリック時にwindow.confirm()でユーザーに確認し、キャンセルされた場合は
// フォーム送信自体を止める。
export default function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
