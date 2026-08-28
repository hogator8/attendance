-- 権限モデルv2への移行
--
-- 変更点：
--   ・staff_class_permissions はクラスごとの「出席入力」可否のみに絞る
--     （can_view_summary 列を削除。閲覧可否は staff_permissions の全体権限へ移行）
--   ・has_class_permission(class_id) は「そのクラスへの出席入力が可能か」のみを返す
--     関数に単純化する（p_need 引数を廃止）
--   ・has_permission(flag) で staff_permissions の機能単位フラグを判定する
--   ・admin は常にフルアクセス（is_admin() が全ての判定に優先する）
--
-- 各テーブルの書き込み権限の対応：
--   students                                  → can_manage_students
--   class_enrollments / elective_memberships  → can_manage_students（学生の所属管理）
--   classes / timetable_*                     → can_manage_classes
--   events / event_replaced_periods / event_classes / schedule_change_overrides
--                                              → can_manage_classes
--   symbols / conversion_rules / color_rules / term_settings / holidays / terms
--                                              → can_manage_settings
--   staff / staff_class_permissions / staff_permissions
--                                              → can_manage_staff
--   historical_monthly_summaries（過去データ取り込み）
--                                              → can_manage_students

-- ============================================================
-- staff_class_permissions：閲覧可否列を削除
-- ============================================================
alter table staff_class_permissions drop column can_view_summary;

-- ============================================================
-- 権限判定関数の再定義
-- ============================================================
-- 依存する旧ポリシー（'input'/'view'/'any' を引数に取っていたもの）は全て
-- このファイル内で新しい定義に作り直すため、CASCADEで一括削除してよい。
drop function if exists has_class_permission(uuid, text) cascade;

-- そのクラスへの出席入力が可能かどうか（admin は常に true）
create or replace function has_class_permission(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from staff_class_permissions p
      where p.staff_id = auth.uid()
        and p.class_id = p_class_id
        and p.can_input
    );
$$;

-- staff_permissions の機能単位フラグを判定する（admin は常に true）
-- p_flag は staff_permissions の列名のいずれかに一致させる
create or replace function has_permission(p_flag text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from staff_permissions sp
      where sp.staff_id = auth.uid()
        and case p_flag
          when 'can_view_summary' then sp.can_view_summary
          when 'can_manage_students' then sp.can_manage_students
          when 'can_manage_classes' then sp.can_manage_classes
          when 'can_manage_staff' then sp.can_manage_staff
          when 'can_manage_settings' then sp.can_manage_settings
          when 'can_view_individual_records' then sp.can_view_individual_records
          else false
        end
    );
$$;

-- ============================================================
-- students
-- ============================================================
drop policy if exists students_select on students;
drop policy if exists students_write on students;

create policy students_select on students for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_view_individual_records')
    or has_permission('can_manage_students')
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
create policy students_write on students for all
  using (is_admin() or has_permission('can_manage_students'))
  with check (is_admin() or has_permission('can_manage_students'));

-- ============================================================
-- classes
-- ============================================================
drop policy if exists classes_write on classes;

create policy classes_write on classes for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));

-- ============================================================
-- class_enrollments
-- ============================================================
drop policy if exists class_enrollments_select on class_enrollments;
drop policy if exists class_enrollments_write on class_enrollments;

create policy class_enrollments_select on class_enrollments for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_manage_students')
    or has_class_permission(class_id)
  );
create policy class_enrollments_write on class_enrollments for all
  using (is_admin() or has_permission('can_manage_students'))
  with check (is_admin() or has_permission('can_manage_students'));

-- ============================================================
-- elective_memberships
-- ============================================================
drop policy if exists elective_memberships_select on elective_memberships;
drop policy if exists elective_memberships_write on elective_memberships;

create policy elective_memberships_select on elective_memberships for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_manage_students')
    or has_class_permission(class_id)
  );
create policy elective_memberships_write on elective_memberships for all
  using (is_admin() or has_permission('can_manage_students'))
  with check (is_admin() or has_permission('can_manage_students'));

-- ============================================================
-- timetable_versions / timetable_slots
-- ============================================================
drop policy if exists timetable_versions_write on timetable_versions;
drop policy if exists timetable_slots_write on timetable_slots;

create policy timetable_versions_write on timetable_versions for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));
create policy timetable_slots_write on timetable_slots for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));

-- ============================================================
-- events / event_replaced_periods / event_classes
-- ============================================================
drop policy if exists events_write on events;
drop policy if exists event_replaced_periods_write on event_replaced_periods;
drop policy if exists event_classes_write on event_classes;

create policy events_write on events for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));
create policy event_replaced_periods_write on event_replaced_periods for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));
create policy event_classes_write on event_classes for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));

-- ============================================================
-- symbols / conversion_rules / color_rules / term_settings / holidays / terms
-- ============================================================
drop policy if exists symbols_write on symbols;
drop policy if exists conversion_rules_write on conversion_rules;
drop policy if exists color_rules_write on color_rules;
drop policy if exists term_settings_write on term_settings;
drop policy if exists holidays_write on holidays;
drop policy if exists terms_write on terms;

create policy symbols_write on symbols for all
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));
create policy conversion_rules_write on conversion_rules for all
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));
create policy color_rules_write on color_rules for all
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));
create policy term_settings_write on term_settings for all
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));
create policy holidays_write on holidays for all
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));
create policy terms_write on terms for all
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));

-- ============================================================
-- attendance_records
-- ============================================================
drop policy if exists attendance_records_select on attendance_records;
drop policy if exists attendance_records_insert on attendance_records;
drop policy if exists attendance_records_update on attendance_records;
drop policy if exists attendance_records_delete on attendance_records;

create policy attendance_records_select on attendance_records for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_view_individual_records')
    or has_class_permission(class_id)
  );
create policy attendance_records_insert on attendance_records for insert
  with check (
    (is_admin() or has_class_permission(class_id))
    and recorded_by = auth.uid()
  );
create policy attendance_records_update on attendance_records for update
  using (is_admin() or has_class_permission(class_id))
  with check (
    (is_admin() or has_class_permission(class_id))
    and recorded_by = auth.uid()
  );
create policy attendance_records_delete on attendance_records for delete
  using (is_admin() or has_class_permission(class_id));

-- ============================================================
-- event_attendance
-- ============================================================
drop policy if exists event_attendance_select on event_attendance;
drop policy if exists event_attendance_insert on event_attendance;
drop policy if exists event_attendance_update on event_attendance;
drop policy if exists event_attendance_delete on event_attendance;

create policy event_attendance_select on event_attendance for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_view_individual_records')
    or exists (
      select 1 from event_applicable_classes(event_id) eac
      where has_class_permission(eac.class_id)
    )
  );
create policy event_attendance_insert on event_attendance for insert
  with check (
    (
      is_admin()
      or exists (
        select 1 from event_applicable_classes(event_id) eac
        where has_class_permission(eac.class_id)
      )
    )
    and recorded_by = auth.uid()
  );
create policy event_attendance_update on event_attendance for update
  using (
    is_admin()
    or exists (
      select 1 from event_applicable_classes(event_id) eac
      where has_class_permission(eac.class_id)
    )
  )
  with check (
    (
      is_admin()
      or exists (
        select 1 from event_applicable_classes(event_id) eac
        where has_class_permission(eac.class_id)
      )
    )
    and recorded_by = auth.uid()
  );
create policy event_attendance_delete on event_attendance for delete
  using (
    is_admin()
    or exists (
      select 1 from event_applicable_classes(event_id) eac
      where has_class_permission(eac.class_id)
    )
  );

-- ============================================================
-- staff（role='admin' の行は can_manage_staff を持つ非adminからは
-- 変更・削除できないようにし、非adminがadminへ昇格することも防ぐ）
-- ============================================================
drop policy if exists staff_write on staff;

create policy staff_write on staff for all
  using (
    is_admin()
    or (has_permission('can_manage_staff') and role <> 'admin')
  )
  with check (
    is_admin()
    or (has_permission('can_manage_staff') and role <> 'admin')
  );

-- ============================================================
-- staff_class_permissions / staff_permissions
-- ============================================================
drop policy if exists staff_class_permissions_write on staff_class_permissions;
drop policy if exists staff_permissions_write on staff_permissions;

create policy staff_class_permissions_write on staff_class_permissions for all
  using (is_admin() or has_permission('can_manage_staff'))
  with check (is_admin() or has_permission('can_manage_staff'));
create policy staff_permissions_write on staff_permissions for all
  using (is_admin() or has_permission('can_manage_staff'))
  with check (is_admin() or has_permission('can_manage_staff'));

-- ============================================================
-- schedule_change_overrides
-- ============================================================
alter table schedule_change_overrides enable row level security;

create policy schedule_change_overrides_select on schedule_change_overrides for select
  using (is_staff_member());
create policy schedule_change_overrides_write on schedule_change_overrides for all
  using (is_admin() or has_permission('can_manage_classes'))
  with check (is_admin() or has_permission('can_manage_classes'));

-- ============================================================
-- historical_monthly_summaries
-- ============================================================
alter table historical_monthly_summaries enable row level security;

create policy historical_monthly_summaries_select on historical_monthly_summaries for select
  using (
    is_admin()
    or has_permission('can_view_summary')
    or has_permission('can_view_individual_records')
  );
create policy historical_monthly_summaries_write on historical_monthly_summaries for all
  using (is_admin() or has_permission('can_manage_students'))
  with check (is_admin() or has_permission('can_manage_students'));
