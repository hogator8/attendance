import "server-only";

// redirect() を伴うServer Action（新規作成後に詳細ページへ遷移する等）は、
// redirect() 以降のコードが実行されないため、遷移元ページで直接トーストを
// 表示できない。遷移先URLに ?flash=メッセージ を付与しておくことで、
// ToastProvider（src/components/toast/ToastProvider.tsx）が遷移後に検知して
// トーストを表示する。
export function withFlash(path: string, message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}flash=${encodeURIComponent(message)}`;
}
