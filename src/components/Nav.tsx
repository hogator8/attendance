import Link from "next/link";
import type { CurrentStaff } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { signOut } from "@/app/login/actions";

type StaffPermissions = Omit<
  Database["public"]["Tables"]["staff_permissions"]["Row"],
  "staff_id"
>;

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  full_time: "専任",
  part_time: "非常勤",
};

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path d="M3 9.5 10 3l7 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V17h10V8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconAttendance() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <path d="M3 8h14" strokeLinecap="round" />
      <path d="M7 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSummary() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path d="M4 16V9M10 16V4M16 16v-6" strokeLinecap="round" />
      <path d="M3 17h14" strokeLinecap="round" />
    </svg>
  );
}
function IconStudents() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="14" cy="8" r="2" />
      <path d="M2.5 16c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5" strokeLinecap="round" />
      <path d="M11.5 16c.4-2.3 1.6-3.5 3-3.5s2.7 1.2 3 3.5" strokeLinecap="round" />
    </svg>
  );
}
function IconClasses() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path d="M3 17V7l7-4 7 4v10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStaff() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c.7-4 2.8-6 6-6s5.3 2 6 6" strokeLinecap="round" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="10" cy="10" r="2.5" />
      <path
        d="M10 3v1.5M10 15.5V17M17 10h-1.5M4.5 10H3M15 5l-1 1M6 14l-1 1M15 15l-1-1M6 6 5 5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconCsv() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path d="M5 3h7l3 3v11H5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8v5M7.5 10.5h5" strokeLinecap="round" />
    </svg>
  );
}

export default function Nav({
  staff,
  permissions,
}: {
  staff: CurrentStaff;
  permissions: StaffPermissions;
}) {
  type NavLink = { href: string; label: string; icon: React.ReactNode };
  const links: NavLink[] = [
    { href: "/home", label: "ホーム", icon: <IconHome /> },
    { href: "/attendance", label: "出席入力", icon: <IconAttendance /> },
    { href: "/summary", label: "集計", icon: <IconSummary /> },
    { href: "/csv-import", label: "CSV読み込み", icon: <IconCsv /> },
  ];
  if (permissions.can_manage_students) {
    links.push({ href: "/students", label: "学生管理", icon: <IconStudents /> });
  }
  if (permissions.can_manage_classes) {
    links.push({ href: "/classes", label: "クラス管理", icon: <IconClasses /> });
  }
  if (permissions.can_manage_staff) {
    links.push({ href: "/staff", label: "教員管理", icon: <IconStaff /> });
  }
  if (permissions.can_manage_settings) {
    links.push({ href: "/settings", label: "設定", icon: <IconSettings /> });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/home" className="text-base font-bold text-slate-900">
            出席管理システム
          </Link>
          <nav className="flex flex-wrap gap-1.5 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {staff.name}
            <span className="ml-1 text-xs">
              ({ROLE_LABEL[staff.role] ?? staff.role})
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
