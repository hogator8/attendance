import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getActiveTerm(supabase: Client) {
  const { data } = await supabase
    .from("terms")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getTermDecimalDigits(supabase: Client, termId: string) {
  const { data } = await supabase
    .from("term_settings")
    .select("percent_decimal_digits")
    .eq("term_id", termId)
    .maybeSingle();
  return data?.percent_decimal_digits ?? 1;
}
