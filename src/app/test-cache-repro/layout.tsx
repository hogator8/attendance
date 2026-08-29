import ToastProvider from "@/components/toast/ToastProvider";

export default function TestCacheReproLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
