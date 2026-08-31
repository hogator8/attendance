"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 学生区分（長期生／短期生など）の設定を保存する。学期に依存しないグローバルな
// データのため、symbols（出席記号設定）と同様に最大10件・order_no固定枠で管理する。
export async function saveStudentCategories(formData: FormData) {
  await requirePermission("can_manage_settings");
  const supabase = await createClient();

  const rows: { order_no: number; name: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const name = String(formData.get(`name_${i}`) ?? "").trim();
    if (!name) continue;
    rows.push({ order_no: i, name });
  }

  // students.category_id は student_categories.id への on delete restrict の
  // 外部キーのため、既に学生に割り当てられている区分を削除し直すと外部キー
  // 違反になる。symbolsの保存処理と同様、フォームで空欄にされた枠だけを削除し、
  // それ以外はIDを維持したままUPDATEする。
  const { data: existing, error: fetchError } = await supabase
    .from("student_categories")
    .select("order_no");
  if (fetchError) throw new Error(fetchError.message);

  const keptOrderNos = new Set(rows.map((r) => r.order_no));
  const orderNosToDelete = (existing ?? [])
    .map((c) => c.order_no)
    .filter((n) => !keptOrderNos.has(n));

  if (orderNosToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("student_categories")
      .delete()
      .in("order_no", orderNosToDelete);
    if (deleteError) {
      if (deleteError.code === "23503") {
        throw new Error(
          "既に学生に割り当てられている学生区分は削除できません。削除する代わりに内容を編集してご利用いただくか、該当の学生の区分を変更してから改めて削除してください。",
        );
      }
      throw new Error(deleteError.message);
    }
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("student_categories")
      .upsert(rows, { onConflict: "order_no" });
    if (upsertError) throw new Error(upsertError.message);
  }

  revalidatePath("/settings/student-categories");
  revalidatePath("/students");
  revalidatePath("/students/new");
}
