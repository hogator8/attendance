import type { SymbolCategory } from "@/lib/supabase/database.types";

// 出席率計算ロジック（現行Excelマクロの RunSummary / CalcConvertedAbsences / GetSymbolInfo と同じルール）。
// 通常授業（時限単位、weight=1）と学校行事（event_attendance、weight=credit_periods）を
// 同じ「重み付きレコード」として扱うことで、両者を同じ計算式で処理する。

export interface SymbolInfo {
  id: string;
  category: SymbolCategory;
  countsAsRequired: boolean;
  isLateEarlyTarget: boolean;
}

export interface WeightedRecord {
  symbolId: string;
  // 通常の時限出席なら 1、学校行事の出席なら該当行事の credit_periods
  weight: number;
}

export interface ConversionRule {
  lateN: number;
  earlyN: number;
  combinedN: number;
}

export interface AttendanceRateResult {
  reqDays: number;
  rawAbsCount: number;
  lateCount: number;
  earlyCount: number;
  convertedAbsences: number;
  totalAbsences: number;
  /** category='excused'（公欠）記号の合計weight */
  excusedCount: number;
  /** 0〜1 の出席率。reqDays が 0 の場合は 0。 */
  rate: number;
  /** 記号ごとの集計日数（表示用）。symbolId -> 合計weight */
  symbolCounts: Record<string, number>;
}

function calcConvertedAbsences(
  lateCount: number,
  earlyCount: number,
  hasLateSymbol: boolean,
  hasEarlySymbol: boolean,
  rule: ConversionRule,
): number {
  // 合算ルールが設定されており、遅刻・早退の両方の記号が定義されている場合は
  // 合算のみで計算し、個別ルールとの二重適用を避ける（VBA CalcConvertedAbsences と同一挙動）
  if (rule.combinedN > 0 && hasLateSymbol && hasEarlySymbol) {
    return Math.floor((lateCount + earlyCount) / rule.combinedN);
  }

  let converted = 0;
  if (rule.lateN > 0 && hasLateSymbol) {
    converted += Math.floor(lateCount / rule.lateN);
  }
  if (rule.earlyN > 0 && hasEarlySymbol) {
    converted += Math.floor(earlyCount / rule.earlyN);
  }
  return converted;
}

export function calculateAttendanceRate(
  records: WeightedRecord[],
  symbols: SymbolInfo[],
  rule: ConversionRule,
): AttendanceRateResult {
  const symbolById = new Map(symbols.map((s) => [s.id, s]));
  const hasLateSymbol = symbols.some(
    (s) => s.category === "late" && s.isLateEarlyTarget,
  );
  const hasEarlySymbol = symbols.some(
    (s) => s.category === "early_leave" && s.isLateEarlyTarget,
  );

  let reqDays = 0;
  let rawAbsCount = 0;
  let lateCount = 0;
  let earlyCount = 0;
  let excusedCount = 0;
  const symbolCounts: Record<string, number> = {};
  for (const s of symbols) symbolCounts[s.id] = 0;

  for (const record of records) {
    const symbol = symbolById.get(record.symbolId);
    if (!symbol) continue;

    symbolCounts[symbol.id] = (symbolCounts[symbol.id] ?? 0) + record.weight;

    if (symbol.countsAsRequired) {
      reqDays += record.weight;
    }
    if (symbol.category === "absence") {
      rawAbsCount += record.weight;
    }
    if (symbol.category === "late" && symbol.isLateEarlyTarget) {
      lateCount += record.weight;
    }
    if (symbol.category === "early_leave" && symbol.isLateEarlyTarget) {
      earlyCount += record.weight;
    }
    if (symbol.category === "excused") {
      excusedCount += record.weight;
    }
  }

  const convertedAbsences = calcConvertedAbsences(
    lateCount,
    earlyCount,
    hasLateSymbol,
    hasEarlySymbol,
    rule,
  );
  const totalAbsences = rawAbsCount + convertedAbsences;
  const rate = reqDays > 0 ? (reqDays - totalAbsences) / reqDays : 0;

  return {
    reqDays,
    rawAbsCount,
    lateCount,
    earlyCount,
    convertedAbsences,
    totalAbsences,
    excusedCount,
    rate,
    symbolCounts,
  };
}

export function formatPercent(rate: number, decimalDigits: number): string {
  return `${(rate * 100).toFixed(decimalDigits)}%`;
}

export interface ColorRule {
  lowerPct: number;
  upperPct: number;
  colorHex: string;
}

export function colorForRate(
  rate: number,
  rules: ColorRule[],
): string | null {
  const pct = rate * 100;
  const rule = rules.find((r) => pct >= r.lowerPct && pct <= r.upperPct);
  return rule ? rule.colorHex : null;
}
