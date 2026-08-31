import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import { saveEvent, deleteEvent } from "./actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
  buttonDangerClass,
} from "@/lib/ui";

const REPLACE_MODE_LABELS: Record<string, string> = {
  all: "全時限を行事に置き換え",
  partial: "指定した時限のみ置き換え",
  none: "通常授業に追加",
};

export default async function EventsSettingsPage({
  params,
}: {
  params: Promise<{ termId: string }>;
}) {
  await requireAdmin();
  const { termId } = await params;
  const supabase = await createClient();

  const [{ data: term }, { data: events }, { data: classes }] =
    await Promise.all([
      supabase.from("terms").select("*").eq("id", termId).maybeSingle(),
      supabase
        .from("events")
        .select("*")
        .eq("term_id", termId)
        .order("date_from"),
      supabase
        .from("classes")
        .select("*")
        .eq("term_id", termId)
        .order("type")
        .order("name"),
    ]);

  if (!term) notFound();

  const eventIds = (events ?? []).map((e) => e.id);
  const [{ data: replacedPeriods }, { data: eventClasses }] =
    eventIds.length > 0
      ? await Promise.all([
          supabase
            .from("event_replaced_periods")
            .select("*")
            .in("event_id", eventIds),
          supabase.from("event_classes").select("*").in("event_id", eventIds),
        ])
      : [{ data: [] }, { data: [] }];

  const periodsByEvent = new Map<string, number[]>();
  for (const rp of replacedPeriods ?? []) {
    const arr = periodsByEvent.get(rp.event_id) ?? [];
    arr.push(rp.period_no);
    periodsByEvent.set(rp.event_id, arr);
  }
  const classesByEvent = new Map<string, string[]>();
  for (const ec of eventClasses ?? []) {
    const arr = classesByEvent.get(ec.event_id) ?? [];
    arr.push(ec.class_id);
    classesByEvent.set(ec.event_id, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/settings/terms/${termId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← {term.name} の設定に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          学校行事設定（{term.name}）
        </h1>
      </div>

      <section className={`${cardClass} max-w-2xl`}>
        <h2 className="mb-3 font-bold text-slate-900">行事を追加</h2>
        <EventForm termId={termId} classes={classes ?? []} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-slate-900">登録済みの行事</h2>
        {(events ?? []).length === 0 && (
          <p className="text-sm text-slate-500">行事はまだ登録されていません。</p>
        )}
        {(events ?? []).map((event) => (
          <details key={event.id} className={`${cardClass} max-w-2xl`}>
            <summary className="cursor-pointer font-medium text-slate-900">
              {event.date_from}
              {event.date_from !== event.date_to ? ` 〜 ${event.date_to}` : ""}{" "}
              {event.name}
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <EventForm
                termId={termId}
                classes={classes ?? []}
                event={event}
                selectedClasses={classesByEvent.get(event.id) ?? []}
                selectedPeriods={periodsByEvent.get(event.id) ?? []}
              />
              <SubmitForm action={deleteEvent} successMessage="行事を削除しました">
                <input type="hidden" name="id" value={event.id} />
                <input type="hidden" name="term_id" value={termId} />
                <button type="submit" className={buttonDangerClass}>
                  この行事を削除
                </button>
              </SubmitForm>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function EventForm({
  termId,
  classes,
  event,
  selectedClasses = [],
  selectedPeriods = [],
}: {
  termId: string;
  classes: { id: string; name: string }[];
  event?: {
    id: string;
    name: string;
    date_from: string;
    date_to: string;
    credit_periods: number;
    replace_mode: string;
  };
  selectedClasses?: string[];
  selectedPeriods?: number[];
}) {
  return (
      <SubmitForm
        action={saveEvent}
        successMessage={event ? "行事を更新しました" : "行事を追加しました"}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="term_id" value={termId} />
        {event && <input type="hidden" name="event_id" value={event.id} />}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>行事名</label>
          <input
            name="name"
            required
            defaultValue={event?.name}
            className={inputClass}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className={labelClass}>開始日</label>
            <input
              type="date"
              name="date_from"
              required
              defaultValue={event?.date_from}
              className={inputClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className={labelClass}>終了日</label>
            <input
              type="date"
              name="date_to"
              required
              defaultValue={event?.date_to}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className={labelClass}>単位時数（要出席・出席時数への換算値）</label>
            <input
              type="number"
              step="0.5"
              min={0}
              name="credit_periods"
              required
              defaultValue={event?.credit_periods ?? 1}
              className={inputClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className={labelClass}>通常授業の扱い</label>
            <select
              name="replace_mode"
              defaultValue={event?.replace_mode ?? "none"}
              className={inputClass}
            >
              {Object.entries(REPLACE_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            置き換え対象の時限（「指定した時限のみ置き換え」の場合のみ。カンマ区切り。例：3,4）
          </label>
          <input
            name="replaced_periods"
            defaultValue={selectedPeriods.join(",")}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            対象クラス（何も選択しなければ全クラス対象）
          </label>
          <div className="flex flex-wrap gap-3">
            {(classes ?? []).map((c) => (
              <label key={c.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="class_ids"
                  value={c.id}
                  defaultChecked={selectedClasses.includes(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <button type="submit" className={buttonPrimaryClass}>
            保存
          </button>
        </div>
      </SubmitForm>
  );
}

