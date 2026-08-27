import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import SubmitForm from "@/components/SubmitForm";
import { createStudent } from "./actions";
import { cardClass, inputClass, labelClass, buttonPrimaryClass } from "@/lib/ui";

export default async function NewStudentPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/students" className="text-sm text-blue-600 hover:underline">
          ← 生徒一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">生徒の新規登録</h1>
      </div>

      <SubmitForm
        action={createStudent}
        successMessage="生徒を登録しました"
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
          <input type="file" name="photo" accept="image/*" className="text-sm" />
        </div>
        <div>
          <button type="submit" className={buttonPrimaryClass}>
            登録
          </button>
        </div>
      </SubmitForm>
    </div>
  );
}
