import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import SubmitForm from "@/components/SubmitForm";
import FileInputButton from "@/components/FileInputButton";
import { createStudent, importStudentsCsv } from "./actions";
import { cardClass, inputClass, labelClass, buttonPrimaryClass } from "@/lib/ui";

export default async function NewStudentPage() {
  await requirePermission("can_manage_students");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/students" className="text-sm text-blue-600 hover:underline">
          ← 学生一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">学生の新規登録</h1>
      </div>

      <SubmitForm
        action={createStudent}
        successMessage="学生を登録しました"
        encType="multipart/form-data"
        className={`${cardClass} flex max-w-md flex-col gap-3`}
      >
        <div className="flex flex-col gap-1">
          <label className={labelClass}>学籍番号</label>
          <input name="student_number" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>氏名</label>
          <input name="name" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>フリガナ</label>
          <input name="furigana" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>国籍（任意）</label>
          <input name="nationality" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>入学日（授業開始日）</label>
          <input
            type="date"
            name="enrollment_date"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>写真（任意）</label>
          <FileInputButton name="photo" accept="image/*" />
        </div>
        <div>
          <button type="submit" className={buttonPrimaryClass}>
            登録
          </button>
        </div>
      </SubmitForm>

      <div className={`${cardClass} max-w-lg`}>
        <h2 className="mb-1 font-bold text-slate-900">CSV一括登録</h2>
        <p className="mb-3 text-xs text-slate-500">
          1行につき「学籍番号,氏名,フリガナ,国籍(任意),YYYY-MM-DD,クラス名(任意)」の形式で入力してください。
          クラス名を指定すると、アクティブな学期の同名ホームルームクラスへ自動配属します。写真は登録後に個別にアップロードしてください。
        </p>
        <SubmitForm
          action={importStudentsCsv}
          successMessage="CSVを一括登録しました"
          className="flex flex-col gap-3"
        >
          <textarea
            name="csv"
            rows={6}
            placeholder={"S2026001,山田太郎,やまだたろう,日本,2026-04-01,初級A"}
            className={`${inputClass} font-mono`}
          />
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              一括登録
            </button>
          </div>
        </SubmitForm>
      </div>
    </div>
  );
}
