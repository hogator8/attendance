import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "出席管理システム",
  description: "日本語学校向け出席管理システム",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
