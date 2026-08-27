import { requireStaff } from "@/lib/auth";
import Nav from "@/components/Nav";
import ToastProvider from "@/components/toast/ToastProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Nav staff={staff} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
