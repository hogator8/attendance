import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import {
  saveSymbols,
  saveConversionRule,
  saveColorRules,
  saveDecimalDigits,
} from "./actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
} from "@/lib/ui";
import type { SymbolCategory } from "@/lib/supabase/database.types";

const CATEGORY_OPTIONS: { value: SymbolCategory; label: string }[] = [
  { value: "attendance", label: "出席" },
  { value: "absence", label: "欠席" },
  { value: "late", label: "遅刻" },
  { value: "early_leave", label: "早退" },
  { value: "excused", label: "公欠" },
  { value: "excluded", label: "除外（要出席時数に含めない）" },
];

export default async function SymbolsSettingsPage({
  params,
}: {
  params: Promise<{ termId: string }>;
}) {
  await requireAdmin();
  const { termId } = await params;
  const supabase = await createClient();

  const [{ data: term }, { data: symbols }, { data: conversionRule }, { data: colorRules }, { data: termSettings }] =
    await Promise.all([
      supabase.from("terms").select("*").eq("id", termId).maybeSingle(),
      supabase
        .from("symbols")
        .select("*")
        .eq("term_id", termId)
        .order("order_no"),
      supabase
        .from("conversion_rules")
        .select("*")
        .eq("term_id", termId)
        .maybeSingle(),
      supabase
        .from("color_rules")
        .select("*")
        .eq("term_id", termId)
        .order("tier_no"),
      supabase
        .from("term_settings")
        .select("*")
        .eq("term_id", termId)
        .maybeSingle(),
    ]);

  if (!term) notFound();

  const symbolRows = Array.from({ length: 10 }, (_, i) => {
    const orderNo = i + 1;
    return symbols?.find((s) => s.order_no === orderNo) ?? null;
  });
  const colorRows = Array.from({ length: 5 }, (_, i) => {
    const tierNo = i + 1;
    return colorRules?.find((c) => c.tier_no === tierNo) ?? null;
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/settings/terms/${termId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← {term.name} の設定に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          出席記号・換算ルール・色分け（{term.name}）
        </h1>
      </div>

      <section className={cardClass}>
        <h2 className="mb-1 font-bold text-slate-900">出席記号設定（最大10種類）</h2>
        <p className="mb-3 text-xs text-slate-500">
          記号・項目名を入力した行のみ有効になります。保存すると既存の設定を置き換えます。
        </p>
        <SubmitForm
          action={saveSymbols}
          successMessage="記号設定を保存しました"
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="term_id" value={termId} />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">#</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">記号</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">項目名</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">集計区分</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">要出席</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">遅早換算対象</th>
                </tr>
              </thead>
              <tbody>
                {symbolRows.map((row, i) => {
                  const n = i + 1;
                  return (
                    <tr key={n}>
                      <td className="border-b border-slate-100 px-2 py-1.5">{n}</td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          name={`symbol_char_${n}`}
                          defaultValue={row?.symbol_char ?? ""}
                          maxLength={4}
                          className={`${inputClass} w-16`}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          name={`label_${n}`}
                          defaultValue={row?.label ?? ""}
                          className={`${inputClass} w-28`}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <select
                          name={`category_${n}`}
                          defaultValue={row?.category ?? "attendance"}
                          className={inputClass}
                        >
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          name={`counts_as_required_${n}`}
                          defaultChecked={row?.counts_as_required ?? true}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          name={`is_late_early_target_${n}`}
                          defaultChecked={row?.is_late_early_target ?? false}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              記号設定を保存
            </button>
          </div>
        </SubmitForm>
      </section>

      <section className={`${cardClass} max-w-xl`}>
        <h2 className="mb-3 font-bold text-slate-900">遅刻・早退の欠席換算ルール</h2>
        <SubmitForm
          action={saveConversionRule}
          successMessage="換算ルールを保存しました"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="term_id" value={termId} />
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>遅刻N回で欠席1（0=換算しない）</label>
              <input
                type="number"
                min={0}
                name="late_n"
                defaultValue={conversionRule?.late_n ?? 0}
                className={`${inputClass} w-24`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>早退N回で欠席1（0=換算しない）</label>
              <input
                type="number"
                min={0}
                name="early_n"
                defaultValue={conversionRule?.early_n ?? 0}
                className={`${inputClass} w-24`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>
                遅刻+早退合算N回で欠席1（0=無効、優先適用）
              </label>
              <input
                type="number"
                min={0}
                name="combined_n"
                defaultValue={conversionRule?.combined_n ?? 0}
                className={`${inputClass} w-24`}
              />
            </div>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              換算ルールを保存
            </button>
          </div>
        </SubmitForm>
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 font-bold text-slate-900">色分けルール（最大5段階）</h2>
        <p className="mb-3 text-xs text-slate-500">
          出席率（%）の範囲に応じて集計画面のセルを色分けします。
        </p>
        <SubmitForm
          action={saveColorRules}
          successMessage="色分けルールを保存しました"
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="term_id" value={termId} />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">段階</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">下限(%)</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">上限(%)</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">色</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">ラベル</th>
                </tr>
              </thead>
              <tbody>
                {colorRows.map((row, i) => {
                  const n = i + 1;
                  return (
                    <tr key={n}>
                      <td className="border-b border-slate-100 px-2 py-1.5">{n}</td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          type="number"
                          step="0.1"
                          name={`lower_pct_${n}`}
                          defaultValue={row?.lower_pct ?? ""}
                          className={`${inputClass} w-20`}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          type="number"
                          step="0.1"
                          name={`upper_pct_${n}`}
                          defaultValue={row?.upper_pct ?? ""}
                          className={`${inputClass} w-20`}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          type="color"
                          name={`color_hex_${n}`}
                          defaultValue={row?.color_hex ?? "#ffffff"}
                          className="h-8 w-14"
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          name={`label_${n}`}
                          defaultValue={row?.label ?? ""}
                          placeholder="例：優良"
                          className={`${inputClass} w-28`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              色分けルールを保存
            </button>
          </div>
        </SubmitForm>
      </section>

      <section className={`${cardClass} max-w-sm`}>
        <h2 className="mb-3 font-bold text-slate-900">表示設定</h2>
        <SubmitForm
          action={saveDecimalDigits}
          successMessage="保存しました"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="term_id" value={termId} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>出席率の小数点桁数</label>
            <select
              name="percent_decimal_digits"
              defaultValue={termSettings?.percent_decimal_digits ?? 1}
              className={inputClass}
            >
              <option value={0}>0桁（例：85%）</option>
              <option value={1}>1桁（例：85.3%）</option>
              <option value={2}>2桁（例：85.34%）</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>1時限あたりの単位数</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              name="credit_hours_per_period"
              defaultValue={termSettings?.credit_hours_per_period ?? 1}
              className={`${inputClass} w-24`}
            />
            <p className="text-xs text-slate-500">
              集計・証明書発行で時限数を「時間数」に換算する際に使用します（時限数 × 単位数）。
            </p>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              保存
            </button>
          </div>
        </SubmitForm>
      </section>
    </div>
  );
}
