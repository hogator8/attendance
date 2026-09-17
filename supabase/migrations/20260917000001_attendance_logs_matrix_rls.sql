-- 出席入力ログページの月次入力状況一覧（getMonthlyCompletionMatrix）を
-- can_view_attendance_logs 権限だけで正しく閲覧できるようにする。
--
-- 月次一覧表は attendance_records / class_enrollments / elective_memberships /
-- students を直接参照するが、これらのSELECTポリシーは can_view_attendance_logs
-- を考慮していなかった（can_view_attendance_logs は attendance_input_logs
-- テーブルのポリシーにしか組み込まれていなかった）。そのため、
-- can_view_summary 等の他の閲覧権限を持たない教員には出席記録・在籍情報が
-- 見えず、授業が組まれている全クラスが常に「未」判定になってしまっていた。

drop policy if exists students_select on students;
create policy students_select on students for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_view_individual_records')
    or has_permission('can_manage_students')
    or has_permission('can_view_attendance_logs')
    or exists (
      select 1 from class_enrollments ce
      where ce.student_id = students.id
        and has_class_permission(ce.class_id)
    )
    or exists (
      select 1 from elective_memberships em
      where em.student_id = students.id
        and has_class_permission(em.class_id)
    )
  );

drop policy if exists class_enrollments_select on class_enrollments;
create policy class_enrollments_select on class_enrollments for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_manage_students')
    or has_permission('can_view_attendance_logs')
    or has_class_permission(class_id)
  );

drop policy if exists elective_memberships_select on elective_memberships;
create policy elective_memberships_select on elective_memberships for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_manage_students')
    or has_permission('can_view_attendance_logs')
    or has_class_permission(class_id)
  );

drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_view_individual_records')
    or has_permission('can_view_attendance_logs')
    or has_class_permission(class_id)
  );
