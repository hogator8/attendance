import Link from "next/link";
import type { CurrentStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const TEACHER_LINKS = [
  { href: "/home", label: "ホーム" },
  { href: "/attendance", label: "出席入力" },
  { href: "/summary", label: "集計" },
];

const ADMIN_LINKS = [
  { href: "/students", label: "生徒管理" },
  { href: "/classes", label: "クラス管理" },
  { href: "/staff", label: "教員管理" },
  { href: "/settings", label: "設定" },
];

export default function Nav({ staff }: { staff: CurrentStaff }) {
  const links =
    staff.role === "admin" ? [...TEACHER_LINKS, ...ADMIN_LINKS] : TEACHER_LINKS;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/home" className="text-base font-bold text-slate-900">
            出席管理システム
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-slate-600 hover:text-blue-600"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {staff.name}
            <span className="ml-1 text-xs">
              ({staff.role === "admin" ? "管理者" : "教員"})
            </span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
