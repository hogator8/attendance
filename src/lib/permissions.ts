import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CurrentStaff } from "@/lib/auth";

type Client = SupabaseClient<Database>;
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

export type PermissionFlag = keyof Omit<
  Database["public"]["Tables"]["staff_permissions"]["Row"],
  "staff_id"
>;

// staff_permissions の機能単位フラグを確認する。admin は常に true。
export async function hasPermission(
  supabase: Client,
  staff: CurrentStaff,
  flag: PermissionFlag,
): Promise<boolean> {
  if (staff.role === "admin") return true;

  const { data } = await supabase
    .from("staff_permissions")
    .select(flag)
    .eq("staff_id", staff.id)
    .maybeSingle();

  return !!(data as Record<string, boolean> | null)?.[flag];
}

// 指定クラスへの出席入力が可能かどうか（クラス単位の権限）。admin は常に true。
export async function canInputClass(
  supabase: Client,
  staff: CurrentStaff,
  classId: string,
): Promise<boolean> {
  if (staff.role === "admin") return true;

  const { data } = await supabase
    .from("staff_class_permissions")
    .select("can_input")
    .eq("staff_id", staff.id)
    .eq("class_id", classId)
    .maybeSingle();

  return !!data?.can_input;
}

// staff が出席入力可能なクラス一覧（termIdで絞り込み）。
export async function getInputAccessibleClasses(
  supabase: Client,
  staff: CurrentStaff,
  termId: string,
): Promise<ClassRow[]> {
  if (staff.role === "admin") {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("term_id", termId)
      .order("type")
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("staff_class_permissions")
    .select("class:classes(*)")
    .eq("staff_id", staff.id)
    .eq("can_input", true);
  if (error) throw error;

  return (data ?? [])
    .map((row) => row.class as ClassRow | null)
    .filter((c): c is ClassRow => !!c && c.term_id === termId)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

// can_view_summary を持つ staff が閲覧可能なクラス一覧（全体権限のため、
// 権限があれば term 内の全クラス、なければ空配列）。
export async function getSummaryAccessibleClasses(
  supabase: Client,
  staff: CurrentStaff,
  termId: string,
): Promise<ClassRow[]> {
  const allowed = await hasPermission(supabase, staff, "can_view_summary");
  if (!allowed) return [];

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("term_id", termId)
    .order("type")
    .order("name");
  if (error) throw error;
  return data ?? [];
}
