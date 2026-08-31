"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESET_CONFIRM_TEXT } from "@/lib/resetConfirmText";

// 全データリセット（管理者専用・完全初期化）。
//
// admin以外のstaff（Supabase Authアカウントごと）を含む、このサイトに
// 登録されている実質すべてのデータを削除する、極めて破壊的かつ取り消し
// 不可能な操作。RLSをバイパスする必要がある（adminであっても、削除対象には
// 他のadminが作成した行や、教員アカウントそのものの削除などRLSの通常の
// 書き込みポリシーでは想定していない操作が含まれるため）ため、
// service_roleクライアント（createAdminClient）を使う。
//
// 削除順序はテーブル間の外部キー制約に従う必要がある。特に
// attendance_records.class_id/symbol_id、event_attendance.symbol_id、
// および両テーブルのrecorded_byはすべて on delete restrict のため、
// これらのテーブルを最初に空にしてからでないと、terms/students/staffの
// カスケード削除が外部キー違反で失敗する。
export async function resetAllData(formData: FormData) {
  await requireAdmin();

  const confirmText = String(formData.get("confirm_text") ?? "");
  if (confirmText !== RESET_CONFIRM_TEXT) {
    throw new Error("確認テキストが一致しません。操作を中止しました。");
  }

  const admin = createAdminClient();

  // 1. 生徒写真をStorageから削除する。写真アップロード時のパス規則
  //   （`${studentId}/photo.jpg`、src/lib/storage.ts）に従って対象パスを
  //   組み立てる。失敗してもDB側のリセット自体は続行する
  //   （孤立したStorageオブジェクトより、リセットが完了しないことの方が
  //   問題が大きいため）。
  const { data: studentsForPhotos } = await admin.from("students").select("id");
  const photoPaths = (studentsForPhotos ?? []).map((s) => `${s.id}/photo.jpg`);
  if (photoPaths.length > 0) {
    await admin.storage.from("student-photos").remove(photoPaths);
  }

  // 2. on delete restrict制約を持つ出席データを先に削除する
  //   （attendance_input_logsもstaff_id/class_idの両方がon delete restrictの
  //   ため、教員・学期の削除より先に空にしておく必要がある）
  const { error: attendanceInputLogsError } = await admin
    .from("attendance_input_logs")
    .delete()
    .not("id", "is", null);
  if (attendanceInputLogsError) {
    throw new Error(`出席入力ログの削除に失敗しました: ${attendanceInputLogsError.message}`);
  }

  const { error: eventAttendanceError } = await admin
    .from("event_attendance")
    .delete()
    .not("id", "is", null);
  if (eventAttendanceError) {
    throw new Error(`学校行事の出席データの削除に失敗しました: ${eventAttendanceError.message}`);
  }

  const { error: attendanceError } = await admin
    .from("attendance_records")
    .delete()
    .not("id", "is", null);
  if (attendanceError) {
    throw new Error(`出席データの削除に失敗しました: ${attendanceError.message}`);
  }

  // 3. termsを削除する。classes/events/symbols/conversion_rules/color_rules/
  //   term_settings/holidaysと、classes・events経由でclass_enrollments/
  //   elective_memberships/timetable_versions/timetable_slots/
  //   event_classes/event_replaced_periods/schedule_change_overrides/
  //   staff_class_permissionsまで、すべてon delete cascadeで連鎖削除される。
  const { error: termsError } = await admin.from("terms").delete().not("id", "is", null);
  if (termsError) {
    throw new Error(`学期データの削除に失敗しました: ${termsError.message}`);
  }

  // 4. studentsを削除する。historical_monthly_summariesがon delete cascadeで
  //   連鎖削除される。
  const { error: studentsError } = await admin.from("students").delete().not("id", "is", null);
  if (studentsError) {
    throw new Error(`学生データの削除に失敗しました: ${studentsError.message}`);
  }

  // 5. 学校全体設定（school_settings）を削除する。次回保存時にid=1で
  //   再作成される想定のため、行ごと削除して問題ない。
  const { error: schoolSettingsError } = await admin
    .from("school_settings")
    .delete()
    .not("id", "is", null);
  if (schoolSettingsError) {
    throw new Error(`学校設定の削除に失敗しました: ${schoolSettingsError.message}`);
  }

  // 5.5. 学生区分設定（student_categories）を削除する。school_settingsと同様、
  //   学期に依存しないグローバルなデータかつテストデータになり得るため対象に含める。
  //   students.category_idは既にstudents削除（手順4）で消えているため
  //   外部キー違反にはならない。
  const { error: studentCategoriesError } = await admin
    .from("student_categories")
    .delete()
    .not("id", "is", null);
  if (studentCategoriesError) {
    throw new Error(`学生区分設定の削除に失敗しました: ${studentCategoriesError.message}`);
  }

  // 6. admin以外のstaffをSupabase Authアカウントごと削除する。
  //   staff.id は auth.users(id) への外部キー(on delete cascade)のため、
  //   Authユーザーを削除すればstaff行・staff_permissions・
  //   staff_class_permissionsも連動して削除される。
  const { data: nonAdminStaff, error: staffFetchError } = await admin
    .from("staff")
    .select("id")
    .neq("role", "admin");
  if (staffFetchError) {
    throw new Error(`教員一覧の取得に失敗しました: ${staffFetchError.message}`);
  }
  for (const s of nonAdminStaff ?? []) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(s.id);
    if (deleteUserError) {
      throw new Error(`教員アカウントの削除に失敗しました: ${deleteUserError.message}`);
    }
  }

  // 7. 念のため、残っているadminそれぞれにstaff_permissions行が存在することを
  //    保証する（既に存在する場合は何もしない）。admin自身のstaff行・
  //    staff_permissions行は上記の削除処理では一切削除していないため
  //    通常は不要だが、防御的に実行しておく。
  const { data: remainingAdmins, error: adminFetchError } = await admin
    .from("staff")
    .select("id")
    .eq("role", "admin");
  if (adminFetchError) {
    throw new Error(`管理者一覧の取得に失敗しました: ${adminFetchError.message}`);
  }
  if (remainingAdmins && remainingAdmins.length > 0) {
    const { error: ensurePermError } = await admin
      .from("staff_permissions")
      .upsert(
        remainingAdmins.map((a) => ({ staff_id: a.id })),
        { onConflict: "staff_id", ignoreDuplicates: true },
      );
    if (ensurePermError) {
      throw new Error(`管理者の権限行の確認に失敗しました: ${ensurePermError.message}`);
    }
  }

  revalidatePath("/", "layout");
}
