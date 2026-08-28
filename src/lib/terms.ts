import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// アクティブな学期は複数同時に存在しうる（排他制御なし）。
// 新しい学期（開始日が新しい順）を先頭にして返す。
export async function getActiveTerms(supabase: Client) {
  const { data } = await supabase
    .from("terms")
    .select("*")
    .eq("is_active", true)
    .order("start_date", { ascending: false });
  return data ?? [];
}

export async function getTermDecimalDigits(supabase: Client, termId: string) {
  const { data } = await supabase
    .from("term_settings")
    .select("percent_decimal_digits")
    .eq("term_id", termId)
    .maybeSingle();
  return data?.percent_decimal_digits ?? 1;
}
