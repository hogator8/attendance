import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">出席管理システム</h1>
        <p className="mb-6 text-sm text-slate-500">
          教員アカウントでログインしてください。
        </p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
