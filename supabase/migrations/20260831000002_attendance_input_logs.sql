-- 出席入力ログ機能。
--
-- 出席入力ページで「保存」が行われるたびに（クラス・授業日・時限単位）、
-- 上書きではなく新しい行として記録し続ける。誰が・いつ・どのクラスの
-- どの授業日のどの時限を、どんな内容で保存したかのスナップショットを
-- 半永久的に蓄積する監査ログのため、保持期間の制限は設けない。

-- ============================================================
-- staff_permissions に「出席入力ログ閲覧」権限を追加
-- ============================================================
alter table staff_permissions
  add column can_view_attendance_logs boolean not null default false;

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
          when 'can_view_attendance_logs' then sp.can_view_attendance_logs
          else false
        end
    );
$$;

-- ============================================================
-- attendance_input_logs
-- ============================================================
-- staff_id・class_idともにon delete restrict（attendance_records等と同様、
-- 監査ログの完全性を優先し、参照先の削除を防ぐ）。学期・クラス・教員の
-- 削除操作（全データリセットを含む）は、このテーブルを先に削除してから
-- 行う必要がある。
create table attendance_input_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete restrict,
  staff_name text not null,
  class_id uuid not null references classes (id) on delete restrict,
  class_name text not null,
  date date not null,
  period_no integer not null,
  recorded_at timestamptz not null default now(),
  -- 対象となった各学生の、その保存時点でのスナップショット（配列）：
  -- [{ student_id, student_number, student_name, symbol_id, symbol_char,
  --    symbol_label, time_value, reason }, ...]
  entries jsonb not null
);

create index attendance_input_logs_date_idx on attendance_input_logs (date);
create index attendance_input_logs_class_idx on attendance_input_logs (class_id);
create index attendance_input_logs_staff_idx on attendance_input_logs (staff_id);

alter table attendance_input_logs enable row level security;

-- 閲覧：新設の can_view_attendance_logs 権限を持つ教員のみ（adminは常に可）
create policy attendance_input_logs_select on attendance_input_logs for select
  using (is_admin() or has_permission('can_view_attendance_logs'));

-- 書き込み：出席入力ページからのみ想定。そのクラスへの出席入力権限を持ち、
-- かつ自分自身をstaff_idとして記録する場合のみ許可する
-- （attendance_records_insertと同じ考え方）。更新・削除は許可しない
-- （追記のみの監査ログとする）。
create policy attendance_input_logs_insert on attendance_input_logs for insert
  with check (
    (is_admin() or has_class_permission(class_id))
    and staff_id = auth.uid()
  );
