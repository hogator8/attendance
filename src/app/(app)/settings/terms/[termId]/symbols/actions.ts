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

  // symbols は attendance_records / event_attendance から symbol_id で
  // 参照される（ON DELETE RESTRICT）ため、既に出席記録で使われている記号を
  // 一度削除して作り直すと外部キー制約違反になる。そのため、フォームで
  // 空欄にされた枠（＝もう使わない枠）だけを削除し、それ以外は行を
  // 作り直さずUPDATEする（IDを維持し、既存の出席記録からの参照を壊さない）。
  const { data: existingSymbols, error: fetchError } = await supabase
    .from("symbols")
    .select("order_no")
    .eq("term_id", termId);
  if (fetchError) {
    console.error("saveSymbols: 既存記号の取得に失敗しました", fetchError);
    throw new Error(fetchError.message);
  }

  const keptOrderNos = new Set(rows.map((r) => r.order_no));
  const orderNosToDelete = (existingSymbols ?? [])
    .map((s) => s.order_no)
    .filter((n) => !keptOrderNos.has(n));

  if (orderNosToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("symbols")
      .delete()
      .eq("term_id", termId)
      .in("order_no", orderNosToDelete);
    if (deleteError) {
      console.error("saveSymbols: 記号の削除に失敗しました", deleteError);
      if (deleteError.code === "23503") {
        throw new Error(
          "既に出席記録で使用されている記号は削除できません。削除する代わりに内容を編集してご利用いただくか、該当の出席記録を修正してから改めて削除してください。",
        );
      }
      throw new Error(deleteError.message);
    }
  }

  // (term_id, symbol_char) のUNIQUE制約はDEFERRABLE INITIALLY DEFERREDに
  // なっているため、2つの記号の文字を入れ替えるような保存でも、この1回の
  // upsertの中で一時的に重複しても最終的に重複していなければエラーになら
  // ない。
  const { error: upsertError } = await supabase
    .from("symbols")
    .upsert(rows, { onConflict: "term_id,order_no" });
  if (upsertError) {
    console.error("saveSymbols: 記号の保存に失敗しました", upsertError);
    if (upsertError.code === "23505") {
      throw new Error(
        "記号が重複しています。他の記号と同じ文字を使わないようにしてください。",
      );
    }
    throw new Error(upsertError.message);
  }

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
  if (error) {
    console.error("saveConversionRule: 換算ルールの保存に失敗しました", error);
    throw new Error(error.message);
  }

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
  if (deleteError) {
    console.error("saveColorRules: 色分けルールの削除に失敗しました", deleteError);
    throw new Error(deleteError.message);
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("color_rules").insert(rows);
    if (insertError) {
      console.error("saveColorRules: 色分けルールの保存に失敗しました", insertError);
      throw new Error(insertError.message);
    }
  }

  revalidatePath(`/settings/terms/${termId}/symbols`);
}

export async function saveDecimalDigits(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  const digits = Number(formData.get("percent_decimal_digits") ?? 1);
  const creditHoursPerPeriod = Number(formData.get("credit_hours_per_period") ?? 1);
  if (!termId || ![0, 1, 2].includes(digits)) {
    throw new Error("小数点桁数は0〜2で指定してください。");
  }
  if (!Number.isFinite(creditHoursPerPeriod) || creditHoursPerPeriod <= 0) {
    throw new Error("1時限あたりの単位数は0より大きい数値で指定してください。");
  }

  const { error } = await supabase.from("term_settings").upsert({
    term_id: termId,
    percent_decimal_digits: digits,
    credit_hours_per_period: creditHoursPerPeriod,
  });
  if (error) {
    console.error("saveDecimalDigits: 表示設定の保存に失敗しました", error);
    throw new Error(error.message);
  }

  revalidatePath(`/settings/terms/${termId}/symbols`);
}
