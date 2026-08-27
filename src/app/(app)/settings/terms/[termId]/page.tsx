import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import { updateTermDates } from "../actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
} from "@/lib/ui";

export default async function TermSettingsPage({
  params,
}: {
  params: Promise<{ termId: string }>;
}) {
  await requireAdmin();
  const { termId } = await params;
  const supabase = await createClient();
  const { data: term } = await supabase
    .from("terms")
    .select("*")
    .eq("id", termId)
    .maybeSingle();

  if (!term) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings/terms" className="text-sm text-blue-600 hover:underline">
          ← 学期一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{term.name}</h1>
      </div>

      <nav className="flex flex-wrap gap-3">
        <Link
          href={`/settings/terms/${term.id}/symbols`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          出席記号・換算ルール・色分け
        </Link>
        <Link
          href={`/settings/terms/${term.id}/holidays`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          休業日設定
        </Link>
        <Link
          href={`/settings/terms/${term.id}/events`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          学校行事設定
        </Link>
      </nav>

      <div className={`${cardClass} max-w-lg`}>
        <h2 className="mb-3 font-bold text-slate-900">学期の基本情報</h2>
        <SubmitForm
          action={updateTermDates}
          successMessage="保存しました"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="term_id" value={term.id} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>学期名</label>
            <input
              name="name"
              defaultValue={term.name}
              required
              className={inputClass}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className={labelClass}>授業開始日</label>
              <input
                type="date"
                name="start_date"
                defaultValue={term.start_date}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className={labelClass}>授業終了日</label>
              <input
                type="date"
                name="end_date"
                defaultValue={term.end_date}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              保存
            </button>
          </div>
        </SubmitForm>
      </div>
    </div>
  );
}
