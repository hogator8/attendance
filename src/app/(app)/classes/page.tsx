import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import { createClass } from "./actions";
import { cardClass, inputClass, labelClass, buttonPrimaryClass } from "@/lib/ui";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ term_id?: string }>;
}) {
  await requireAdmin();
  const { term_id: termIdParam } = await searchParams;
  const supabase = await createClient();

  const { data: terms } = await supabase
    .from("terms")
    .select("*")
    .order("start_date", { ascending: false });

  if (!terms || terms.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        学期がまだ登録されていません。先に
        <Link href="/settings/terms" className="mx-1 text-blue-600 underline">
          学期設定
        </Link>
        を行ってください。
      </p>
    );
  }

  const term =
    terms.find((t) => t.id === termIdParam) ??
    terms.find((t) => t.is_active) ??
    terms[0];

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("term_id", term.id)
    .order("type")
    .order("name");

  const homerooms = (classes ?? []).filter((c) => c.type === "homeroom");
  const electives = (classes ?? []).filter((c) => c.type === "elective");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">クラス管理</h1>
        <form className="mt-2 flex items-center gap-2">
          <label className="text-xs text-slate-500">対象の学期</label>
          <select
            name="term_id"
            defaultValue={term.id}
            className={`${inputClass} w-auto`}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_active ? "（アクティブ）" : ""}
              </option>
            ))}
          </select>
          <button type="submit" className="text-xs text-blue-600 underline">
            切り替え
          </button>
        </form>
      </div>

      <section>
        <h2 className="mb-2 font-bold text-slate-900">ホームルームクラス</h2>
        <ClassList classes={homerooms} />
      </section>

      <section>
        <h2 className="mb-2 font-bold text-slate-900">選択科目</h2>
        <ClassList classes={electives} />
      </section>

      <section className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">新規作成</h2>
        <SubmitForm
          action={createClass}
          successMessage="クラスを作成しました"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="term_id" value={term.id} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>名称</label>
            <input
              name="name"
              required
              placeholder="例：初級A、選択：ビジネス日本語"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>種別</label>
            <select name="type" className={inputClass} defaultValue="homeroom">
              <option value="homeroom">ホームルームクラス</option>
              <option value="elective">選択科目</option>
            </select>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              作成
            </button>
          </div>
        </SubmitForm>
      </section>
    </div>
  );
}

function ClassList({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  if (classes.length === 0) {
    return <p className="text-sm text-slate-500">まだ登録されていません。</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((c) => (
        <li key={c.id}>
          <Link
            href={`/classes/${c.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-400"
          >
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
