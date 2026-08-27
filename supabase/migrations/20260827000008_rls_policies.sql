-- RLS有効化とポリシー定義
-- 方針：
--   ・admin は常に全操作可能
--   ・設定系（学期・記号・時間割・休業日・行事など）は「全教員が閲覧可、admin のみ書き込み可」
--   ・生徒・出席データは staff_class_permissions に基づいてクラス単位でアクセス制御

-- ============================================================
-- terms
-- ============================================================
alter table terms enable row level security;

create policy terms_select on terms for select
  using (is_staff_member());
create policy terms_write on terms for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- staff
-- ============================================================
alter table staff enable row level security;

create policy staff_select on staff for select
  using (is_admin() or id = auth.uid());
create policy staff_write on staff for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- students
-- ============================================================
alter table students enable row level security;

create policy students_select on students for select
  using (
    is_admin()
    or exists (
      select 1 from class_enrollments ce
      where ce.student_id = students.id
        and has_class_permission(ce.class_id, 'any')
    )
    or exists (
      select 1 from elective_memberships em
      where em.student_id = students.id
        and has_class_permission(em.class_id, 'any')
    )
  );
create policy students_write on students for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- classes
-- ============================================================
alter table classes enable row level security;

create policy classes_select on classes for select
  using (is_staff_member());
create policy classes_write on classes for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- class_enrollments
-- ============================================================
alter table class_enrollments enable row level security;

create policy class_enrollments_select on class_enrollments for select
  using (is_admin() or has_class_permission(class_id, 'any'));
create policy class_enrollments_write on class_enrollments for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- elective_memberships
-- ============================================================
alter table elective_memberships enable row level security;

create policy elective_memberships_select on elective_memberships for select
  using (is_admin() or has_class_permission(class_id, 'any'));
create policy elective_memberships_write on elective_memberships for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- timetable_versions / timetable_slots
-- ============================================================
alter table timetable_versions enable row level security;
alter table timetable_slots enable row level security;

create policy timetable_versions_select on timetable_versions for select
  using (is_staff_member());
create policy timetable_versions_write on timetable_versions for all
  using (is_admin()) with check (is_admin());

create policy timetable_slots_select on timetable_slots for select
  using (is_staff_member());
create policy timetable_slots_write on timetable_slots for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- events / event_replaced_periods / event_classes
-- ============================================================
alter table events enable row level security;
alter table event_replaced_periods enable row level security;
alter table event_classes enable row level security;

create policy events_select on events for select
  using (is_staff_member());
create policy events_write on events for all
  using (is_admin()) with check (is_admin());

create policy event_replaced_periods_select on event_replaced_periods for select
  using (is_staff_member());
create policy event_replaced_periods_write on event_replaced_periods for all
  using (is_admin()) with check (is_admin());

create policy event_classes_select on event_classes for select
  using (is_staff_member());
create policy event_classes_write on event_classes for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- symbols / conversion_rules / color_rules / term_settings / holidays
-- ============================================================
alter table symbols enable row level security;
alter table conversion_rules enable row level security;
alter table color_rules enable row level security;
alter table term_settings enable row level security;
alter table holidays enable row level security;

create policy symbols_select on symbols for select
  using (is_staff_member());
create policy symbols_write on symbols for all
  using (is_admin()) with check (is_admin());

create policy conversion_rules_select on conversion_rules for select
  using (is_staff_member());
create policy conversion_rules_write on conversion_rules for all
  using (is_admin()) with check (is_admin());

create policy color_rules_select on color_rules for select
  using (is_staff_member());
create policy color_rules_write on color_rules for all
  using (is_admin()) with check (is_admin());

create policy term_settings_select on term_settings for select
  using (is_staff_member());
create policy term_settings_write on term_settings for all
  using (is_admin()) with check (is_admin());

create policy holidays_select on holidays for select
  using (is_staff_member());
create policy holidays_write on holidays for all
  using (is_admin()) with check (is_admin());

-- ============================================================
-- attendance_records
-- ============================================================
alter table attendance_records enable row level security;

create policy attendance_records_select on attendance_records for select
  using (is_admin() or has_class_permission(class_id, 'any'));
create policy attendance_records_insert on attendance_records for insert
  with check (
    (is_admin() or has_class_permission(class_id, 'input'))
    and recorded_by = auth.uid()
  );
create policy attendance_records_update on attendance_records for update
  using (is_admin() or has_class_permission(class_id, 'input'))
  with check (
    (is_admin() or has_class_permission(class_id, 'input'))
    and recorded_by = auth.uid()
  );
create policy attendance_records_delete on attendance_records for delete
  using (is_admin() or has_class_permission(class_id, 'input'));

-- ============================================================
-- event_attendance
-- ============================================================
alter table event_attendance enable row level security;

create policy event_attendance_select on event_attendance for select
  using (
    is_admin()
    or exists (
      select 1 from event_applicable_classes(event_id) eac
      where has_class_permission(eac.class_id, 'any')
    )
  );
create policy event_attendance_insert on event_attendance for insert
  with check (
    (
      is_admin()
      or exists (
        select 1 from event_applicable_classes(event_id) eac
        where has_class_permission(eac.class_id, 'input')
      )
    )
    and recorded_by = auth.uid()
  );
create policy event_attendance_update on event_attendance for update
  using (
    is_admin()
    or exists (
      select 1 from event_applicable_classes(event_id) eac
      where has_class_permission(eac.class_id, 'input')
    )
  )
  with check (
    (
      is_admin()
      or exists (
        select 1 from event_applicable_classes(event_id) eac
        where has_class_permission(eac.class_id, 'input')
      )
    )
    and recorded_by = auth.uid()
  );
create policy event_attendance_delete on event_attendance for delete
  using (
    is_admin()
    or exists (
      select 1 from event_applicable_classes(event_id) eac
      where has_class_permission(eac.class_id, 'input')
    )
  );

-- ============================================================
-- staff_class_permissions
-- ============================================================
alter table staff_class_permissions enable row level security;

create policy staff_class_permissions_select on staff_class_permissions for select
  using (is_admin() or staff_id = auth.uid());
create policy staff_class_permissions_write on staff_class_permissions for all
  using (is_admin()) with check (is_admin());
