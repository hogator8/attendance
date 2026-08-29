-- パフォーマンス改善指示書#06 の2番：RLSポリシーの重複解消（応急対応）
--
-- これまで書き込み系のポリシーは FOR ALL で定義されており、SELECT/INSERT/UPDATE/DELETE
-- すべてに適用されていた。一方で同じテーブルには別途 FOR SELECT のポリシーも存在するため、
-- PostgreSQLのRLSは同一コマンドに適用される permissive ポリシーをOR結合してすべて評価する
-- 仕様上、SELECT実行時に「FOR SELECT ポリシー」と「FOR ALL ポリシー」の両方が評価されて
-- しまい、書き込み権限チェック（has_permission等）が読み取りのたびに無駄に実行されていた。
--
-- 対応：書き込み専用の FOR ALL ポリシーを FOR INSERT / FOR UPDATE / FOR DELETE に分割し、
-- SELECT実行時には書き込み系ポリシーが一切評価されないようにする。
-- 各分割後ポリシーの条件式（USING/WITH CHECK）は、分割前の FOR ALL ポリシーの式と
-- 完全に同一の文字列であり、権限の意味（誰が何を操作できるか）は一切変更していない。
-- FOR SELECT ポリシーは今回のマイグレーションでは一切変更しない。
--
-- 対象外（元々 FOR INSERT/UPDATE/DELETE に分割済みのため対応不要）：
--   attendance_records, event_attendance
--
-- 「本格対策」（RLSポリシー構造自体の見直し。相関サブクエリの多用など）は今回のスコープ外。

drop policy if exists class_enrollments_write on class_enrollments;

create policy class_enrollments_insert on class_enrollments for insert
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy class_enrollments_update on class_enrollments for update
  using ((is_admin() OR has_permission('can_manage_students'::text)))
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy class_enrollments_delete on class_enrollments for delete
  using ((is_admin() OR has_permission('can_manage_students'::text)));

drop policy if exists classes_write on classes;

create policy classes_insert on classes for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy classes_update on classes for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy classes_delete on classes for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));

drop policy if exists color_rules_write on color_rules;

create policy color_rules_insert on color_rules for insert
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy color_rules_update on color_rules for update
  using ((is_admin() OR has_permission('can_manage_settings'::text)))
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy color_rules_delete on color_rules for delete
  using ((is_admin() OR has_permission('can_manage_settings'::text)));

drop policy if exists conversion_rules_write on conversion_rules;

create policy conversion_rules_insert on conversion_rules for insert
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy conversion_rules_update on conversion_rules for update
  using ((is_admin() OR has_permission('can_manage_settings'::text)))
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy conversion_rules_delete on conversion_rules for delete
  using ((is_admin() OR has_permission('can_manage_settings'::text)));

drop policy if exists elective_memberships_write on elective_memberships;

create policy elective_memberships_insert on elective_memberships for insert
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy elective_memberships_update on elective_memberships for update
  using ((is_admin() OR has_permission('can_manage_students'::text)))
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy elective_memberships_delete on elective_memberships for delete
  using ((is_admin() OR has_permission('can_manage_students'::text)));

drop policy if exists event_classes_write on event_classes;

create policy event_classes_insert on event_classes for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy event_classes_update on event_classes for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy event_classes_delete on event_classes for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));

drop policy if exists event_replaced_periods_write on event_replaced_periods;

create policy event_replaced_periods_insert on event_replaced_periods for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy event_replaced_periods_update on event_replaced_periods for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy event_replaced_periods_delete on event_replaced_periods for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));

drop policy if exists events_write on events;

create policy events_insert on events for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy events_update on events for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy events_delete on events for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));

drop policy if exists historical_monthly_summaries_write on historical_monthly_summaries;

create policy historical_monthly_summaries_insert on historical_monthly_summaries for insert
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy historical_monthly_summaries_update on historical_monthly_summaries for update
  using ((is_admin() OR has_permission('can_manage_students'::text)))
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy historical_monthly_summaries_delete on historical_monthly_summaries for delete
  using ((is_admin() OR has_permission('can_manage_students'::text)));

drop policy if exists holidays_write on holidays;

create policy holidays_insert on holidays for insert
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy holidays_update on holidays for update
  using ((is_admin() OR has_permission('can_manage_settings'::text)))
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy holidays_delete on holidays for delete
  using ((is_admin() OR has_permission('can_manage_settings'::text)));

drop policy if exists schedule_change_overrides_write on schedule_change_overrides;

create policy schedule_change_overrides_insert on schedule_change_overrides for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy schedule_change_overrides_update on schedule_change_overrides for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy schedule_change_overrides_delete on schedule_change_overrides for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));

drop policy if exists school_settings_write on school_settings;

create policy school_settings_insert on school_settings for insert
  with check (is_admin());

create policy school_settings_update on school_settings for update
  using (is_admin())
  with check (is_admin());

create policy school_settings_delete on school_settings for delete
  using (is_admin());

drop policy if exists staff_write on staff;

create policy staff_insert on staff for insert
  with check ((is_admin() OR (has_permission('can_manage_staff'::text) AND (role <> 'admin'::staff_role))));

create policy staff_update on staff for update
  using ((is_admin() OR (has_permission('can_manage_staff'::text) AND (role <> 'admin'::staff_role))))
  with check ((is_admin() OR (has_permission('can_manage_staff'::text) AND (role <> 'admin'::staff_role))));

create policy staff_delete on staff for delete
  using ((is_admin() OR (has_permission('can_manage_staff'::text) AND (role <> 'admin'::staff_role))));

drop policy if exists staff_class_permissions_write on staff_class_permissions;

create policy staff_class_permissions_insert on staff_class_permissions for insert
  with check ((is_admin() OR has_permission('can_manage_staff'::text)));

create policy staff_class_permissions_update on staff_class_permissions for update
  using ((is_admin() OR has_permission('can_manage_staff'::text)))
  with check ((is_admin() OR has_permission('can_manage_staff'::text)));

create policy staff_class_permissions_delete on staff_class_permissions for delete
  using ((is_admin() OR has_permission('can_manage_staff'::text)));

drop policy if exists staff_permissions_write on staff_permissions;

create policy staff_permissions_insert on staff_permissions for insert
  with check ((is_admin() OR has_permission('can_manage_staff'::text)));

create policy staff_permissions_update on staff_permissions for update
  using ((is_admin() OR has_permission('can_manage_staff'::text)))
  with check ((is_admin() OR has_permission('can_manage_staff'::text)));

create policy staff_permissions_delete on staff_permissions for delete
  using ((is_admin() OR has_permission('can_manage_staff'::text)));

drop policy if exists students_write on students;

create policy students_insert on students for insert
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy students_update on students for update
  using ((is_admin() OR has_permission('can_manage_students'::text)))
  with check ((is_admin() OR has_permission('can_manage_students'::text)));

create policy students_delete on students for delete
  using ((is_admin() OR has_permission('can_manage_students'::text)));

drop policy if exists symbols_write on symbols;

create policy symbols_insert on symbols for insert
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy symbols_update on symbols for update
  using ((is_admin() OR has_permission('can_manage_settings'::text)))
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy symbols_delete on symbols for delete
  using ((is_admin() OR has_permission('can_manage_settings'::text)));

drop policy if exists term_settings_write on term_settings;

create policy term_settings_insert on term_settings for insert
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy term_settings_update on term_settings for update
  using ((is_admin() OR has_permission('can_manage_settings'::text)))
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy term_settings_delete on term_settings for delete
  using ((is_admin() OR has_permission('can_manage_settings'::text)));

drop policy if exists terms_write on terms;

create policy terms_insert on terms for insert
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy terms_update on terms for update
  using ((is_admin() OR has_permission('can_manage_settings'::text)))
  with check ((is_admin() OR has_permission('can_manage_settings'::text)));

create policy terms_delete on terms for delete
  using ((is_admin() OR has_permission('can_manage_settings'::text)));

drop policy if exists timetable_slots_write on timetable_slots;

create policy timetable_slots_insert on timetable_slots for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy timetable_slots_update on timetable_slots for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy timetable_slots_delete on timetable_slots for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));

drop policy if exists timetable_versions_write on timetable_versions;

create policy timetable_versions_insert on timetable_versions for insert
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy timetable_versions_update on timetable_versions for update
  using ((is_admin() OR has_permission('can_manage_classes'::text)))
  with check ((is_admin() OR has_permission('can_manage_classes'::text)));

create policy timetable_versions_delete on timetable_versions for delete
  using ((is_admin() OR has_permission('can_manage_classes'::text)));
