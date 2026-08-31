import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvField } from "@/lib/csv";
import { todayISO } from "@/lib/date";
import type { AttendanceInputLogEntry } from "@/lib/supabase/database.types";

// 出席入力ログのCSV出力。件数が膨大になりうるため、全件を一度にメモリへ
// 読み込むのではなく、ページングしながらDBに問い合わせ、取得できた分から
// 順にストリームへ書き出す（サーバー側のピークメモリ・レスポンス開始までの
// 待ち時間の両方をページサイズ分に抑える）。
const PAGE_SIZE = 500;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Tokyo", hour12: false });
}

export async function GET(request: NextRequest) {
  await requirePermission("can_view_attendance_logs");
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;
  const classId = searchParams.get("class_id") || undefined;
  const staffId = searchParams.get("staff_id") || undefined;

  const header = "ログ日時,保存した教員名,クラス名,授業日,時限,学生名,出席記号,遅刻早退時刻,理由\n";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      // 先頭にUTF-8 BOM（既存の他のCSV出力箇所と同様、Excelでの文字化け対策）
      controller.enqueue(encoder.encode("﻿" + header));

      let offset = 0;
      for (;;) {
        let query = supabase
          .from("attendance_input_logs")
          .select("staff_name, class_name, date, period_no, recorded_at, entries")
          .order("recorded_at", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (dateFrom) query = query.gte("date", dateFrom);
        if (dateTo) query = query.lte("date", dateTo);
        if (classId) query = query.eq("class_id", classId);
        if (staffId) query = query.eq("staff_id", staffId);

        const { data: rows, error } = await query;
        if (error) {
          controller.error(error);
          return;
        }
        if (!rows || rows.length === 0) break;

        let chunk = "";
        for (const row of rows) {
          const entries = row.entries as AttendanceInputLogEntry[];
          for (const entry of entries) {
            const symbolText = entry.symbol_char
              ? `${entry.symbol_char}（${entry.symbol_label ?? ""}）`
              : "";
            chunk += [
              formatTimestamp(row.recorded_at),
              csvField(row.staff_name),
              csvField(row.class_name),
              row.date,
              String(row.period_no),
              csvField(entry.student_name),
              csvField(symbolText),
              entry.time_value ?? "",
              csvField(entry.reason ?? ""),
            ].join(",") + "\n";
          }
        }
        controller.enqueue(encoder.encode(chunk));

        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      controller.close();
    },
  });

  const fileName = `出席入力ログ_${todayISO()}.csv`;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
