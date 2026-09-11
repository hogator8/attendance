"use client";

import { useRouter } from "next/navigation";
import { inputClass, buttonSecondaryClass } from "@/lib/ui";

// 「前日」「翌日」ボタン・日付欄の変更、いずれも即座に該当日付へ遷移する
// （従来あった「表示」ボタンは廃止）。
export default function AttendanceDateNav({
  classId,
  date,
  prevDate,
  nextDate,
}: {
  classId: string;
  date: string;
  prevDate: string;
  nextDate: string;
}) {
  const router = useRouter();

  function goTo(newDate: string) {
    router.push(`/attendance/${classId}?date=${newDate}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => goTo(prevDate)} className={buttonSecondaryClass}>
        前日
      </button>
      <input
        type="date"
        defaultValue={date}
        onChange={(e) => {
          if (e.target.value) goTo(e.target.value);
        }}
        className={inputClass}
      />
      <button type="button" onClick={() => goTo(nextDate)} className={buttonSecondaryClass}>
        翌日
      </button>
    </div>
  );
}
