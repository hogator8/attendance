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
          <label className={labelClass}>性別（任意）</label>
          <input name="gender" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>生年月日（任意）</label>
          <input type="date" name="date_of_birth" className={inputClass} />
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
          <label className={labelClass}>卒業予定年月日（任意）</label>
          <input type="date" name="expected_graduation_date" className={inputClass} />
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
          「学籍番号,氏名,フリガナ,国籍,性別,生年月日,入学日,卒業予定年月日,クラス名」の形式のCSVファイルを選択してください（国籍・性別・生年月日・卒業予定年月日・クラス名は任意）。
          クラス名を指定すると、アクティブな学期の同名ホームルームクラスへ自動配属します。写真は登録後に個別にアップロードしてください。
          <br />
          <Link href="/students/new/template" className="text-blue-600 underline">
            テンプレートCSVをダウンロード
          </Link>
        </p>
        <SubmitForm
          action={importStudentsCsv}
          successMessage="CSVを一括登録しました"
          encType="multipart/form-data"
          className="flex flex-col gap-3"
        >
          <FileInputButton name="csv" accept=".csv,text/csv" />
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
