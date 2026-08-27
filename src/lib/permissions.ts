import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CurrentStaff } from "@/lib/auth";

type Client = SupabaseClient<Database>;
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

export type PermissionNeed = "input" | "view";

// staff がアクセス可能なクラス一覧（termIdで絞り込み）を返す。
// admin は常に全クラス、teacher は staff_class_permissions で許可されたクラスのみ。
export async function getAccessibleClasses(
  supabase: Client,
  staff: CurrentStaff,
  termId: string,
  need: PermissionNeed,
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

  const column = need === "input" ? "can_input" : "can_view_summary";
  const { data, error } = await supabase
    .from("staff_class_permissions")
    .select("can_input, can_view_summary, class:classes(*)")
    .eq("staff_id", staff.id)
    .eq(column, true);
  if (error) throw error;

  return (data ?? [])
    .map((row) => row.class as ClassRow | null)
    .filter((c): c is ClassRow => !!c && c.term_id === termId)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export async function canAccessClass(
  supabase: Client,
  staff: CurrentStaff,
  classId: string,
  need: PermissionNeed,
): Promise<boolean> {
  if (staff.role === "admin") return true;

  const { data } = await supabase
    .from("staff_class_permissions")
    .select("can_input, can_view_summary")
    .eq("staff_id", staff.id)
    .eq("class_id", classId)
    .maybeSingle();

  if (!data) return false;
  return need === "input" ? data.can_input : data.can_view_summary;
}
