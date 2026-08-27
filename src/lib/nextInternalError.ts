// Next.jsのredirect()/notFound()は、フレームワークが特別に処理する
// digest付きのエラーをthrowする仕組みになっている。共通の保存フォーム
// ラッパー（SubmitForm）でエラーをcatchする際、これらを通常のエラーとして
// 握りつぶしてしまうとリダイレクト等が機能しなくなるため、判定して
// 再throwする必要がある。
export function isNextInternalError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}
