"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SymbolCategory } from "@/lib/supabase/database.types";

const CATEGORIES: SymbolCategory[] = [
  "attendance",
  "absence",
  "late",
  "early_leave",
  "excused",
  "excluded",
];

export async function saveSymbols(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  if (!termId) throw new Error("学期IDが不正です。");

  const rows: {
    term_id: string;
    order_no: number;
    symbol_char: string;
    label: string;
    category: SymbolCategory;
    counts_as_required: boolean;
    is_late_early_target: boolean;
  }[] = [];

  for (let i = 1; i <= 10; i++) {
    const symbolChar = String(formData.get(`symbol_char_${i}`) ?? "").trim();
    const label = String(formData.get(`label_${i}`) ?? "").trim();
    if (!symbolChar || !label) continue;

    const category = String(formData.get(`category_${i}`) ?? "attendance");
    if (!CATEGORIES.includes(category as SymbolCategory)) {
      throw new Error("不正な集計区分です。");
    }

    rows.push({
      term_id: termId,
      order_no: i,
      symbol_char: symbolChar,
      label,
      category: category as SymbolCategory,
      counts_as_required: formData.get(`counts_as_required_${i}`) === "on",
      is_late_early_target: formData.get(`is_late_early_target_${i}`) === "on",
    });
  }

  if (rows.length === 0) {
    throw new Error("出席記号を1つ以上設定してください。");
  }

  const symbolChars = new Set(rows.map((r) => r.symbol_char));
  if (symbolChars.size !== rows.length) {
    throw new Error("記号が重複しています。記号は一意にしてください。");
  }

  // 既存の記号を全削除してから作り直す（10枠固定のシンプルな運用に合わせる）
  const { error: deleteError } = await supabase
    .from("symbols")
    .delete()
    .eq("term_id", termId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from("symbols").insert(rows);
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/settings/terms/${termId}/symbols`);
}

export async function saveConversionRule(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  if (!termId) throw new Error("学期IDが不正です。");

  const lateN = Number(formData.get("late_n") ?? 0);
  const earlyN = Number(formData.get("early_n") ?? 0);
  const combinedN = Number(formData.get("combined_n") ?? 0);

  if (
    !Number.isInteger(lateN) ||
    !Number.isInteger(earlyN) ||
    !Number.isInteger(combinedN) ||
    lateN < 0 ||
    earlyN < 0 ||
    combinedN < 0
  ) {
    throw new Error("換算ルールは0以上の整数で入力してください。");
  }

  const { error } = await supabase
    .from("conversion_rules")
    .upsert({ term_id: termId, late_n: lateN, early_n: earlyN, combined_n: combinedN });
  if (error) throw new Error(error.message);

  revalidatePath(`/settings/terms/${termId}/symbols`);
}

export async function saveColorRules(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  if (!termId) throw new Error("学期IDが不正です。");

  const rows: {
    term_id: string;
    tier_no: number;
    lower_pct: number;
    upper_pct: number;
    color_hex: string;
    label: string | null;
  }[] = [];

  for (let i = 1; i <= 5; i++) {
    const lower = formData.get(`lower_pct_${i}`);
    const upper = formData.get(`upper_pct_${i}`);
    const color = String(formData.get(`color_hex_${i}`) ?? "").trim();
    if (lower === null || upper === null || String(lower) === "" || String(upper) === "" || !color) {
      continue;
    }
    const lowerPct = Number(lower);
    const upperPct = Number(upper);
    if (Number.isNaN(lowerPct) || Number.isNaN(upperPct) || lowerPct > upperPct) {
      throw new Error(`色分けルール${i}段目の範囲が不正です。`);
    }
    rows.push({
      term_id: termId,
      tier_no: i,
      lower_pct: lowerPct,
      upper_pct: upperPct,
      color_hex: color,
      label: String(formData.get(`label_${i}`) ?? "").trim() || null,
    });
  }

  const { error: deleteError } = await supabase
    .from("color_rules")
    .delete()
    .eq("term_id", termId);
  if (deleteError) throw new Error(deleteError.message);

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("color_rules").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath(`/settings/terms/${termId}/symbols`);
}

export async function saveDecimalDigits(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  const digits = Number(formData.get("percent_decimal_digits") ?? 1);
  if (!termId || ![0, 1, 2].includes(digits)) {
    throw new Error("小数点桁数は0〜2で指定してください。");
  }

  const { error } = await supabase
    .from("term_settings")
    .upsert({ term_id: termId, percent_decimal_digits: digits });
  if (error) throw new Error(error.message);

  revalidatePath(`/settings/terms/${termId}/symbols`);
}
