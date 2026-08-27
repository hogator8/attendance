import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type CurrentStaff = Database["public"]["Tables"]["staff"]["Row"];

// ログイン中のユーザーに対応する staff レコードを取得する。
// 未ログイン、または staff レコードが存在しない場合は null。
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return staff;
}

// Server Component / Server Action の先頭で呼び、ログイン済みでなければ /login へ。
export async function requireStaff(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    redirect("/login");
  }
  return staff;
}

// admin専用の画面・操作の先頭で呼ぶ。admin以外はホームへ戻す。
export async function requireAdmin(): Promise<CurrentStaff> {
  const staff = await requireStaff();
  if (staff.role !== "admin") {
    redirect("/home");
  }
  return staff;
}
