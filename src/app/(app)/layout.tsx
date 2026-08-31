import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import ToastProvider from "@/components/toast/ToastProvider";
import type { Database } from "@/lib/supabase/database.types";

type StaffPermissions = Omit<
  Database["public"]["Tables"]["staff_permissions"]["Row"],
  "staff_id"
>;

const FULL_PERMISSIONS: StaffPermissions = {
  can_view_summary: true,
  can_manage_students: true,
  can_manage_classes: true,
  can_manage_staff: true,
  can_manage_settings: true,
  can_view_individual_records: true,
  can_view_attendance_logs: true,
};

const NO_PERMISSIONS: StaffPermissions = {
  can_view_summary: false,
  can_manage_students: false,
  can_manage_classes: false,
  can_manage_staff: false,
  can_manage_settings: false,
  can_view_individual_records: false,
  can_view_attendance_logs: false,
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const supabase = await createClient();

  let permissions = FULL_PERMISSIONS;
  if (staff.role !== "admin") {
    const { data } = await supabase
      .from("staff_permissions")
      .select("*")
      .eq("staff_id", staff.id)
      .maybeSingle();
    permissions = data ? { ...NO_PERMISSIONS, ...data } : NO_PERMISSIONS;
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Nav staff={staff} permissions={permissions} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
