-- 出席データ本体

-- ============================================================
-- attendance_records（日々の出席データ：通常授業・選択科目共通）
-- ============================================================
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  class_id uuid not null references classes (id) on delete restrict,
  date date not null,
  period_no integer not null check (period_no > 0),
  symbol_id uuid not null references symbols (id) on delete restrict,
  recorded_by uuid not null references staff (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (student_id, date, period_no)
);

create index attendance_records_class_date_idx on attendance_records (class_id, date);
create index attendance_records_student_date_idx on attendance_records (student_id, date);
create index attendance_records_symbol_idx on attendance_records (symbol_id);

-- ============================================================
-- event_attendance（学校行事の出席データ）
-- ============================================================
create table event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  symbol_id uuid not null references symbols (id) on delete restrict,
  recorded_by uuid not null references staff (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (event_id, student_id)
);

create index event_attendance_student_idx on event_attendance (student_id);

-- ============================================================
-- staff_class_permissions（教員×クラスの権限）
-- ============================================================
create table staff_class_permissions (
  staff_id uuid not null references staff (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  can_input boolean not null default false,
  can_view_summary boolean not null default false,
  primary key (staff_id, class_id)
);

create index staff_class_permissions_class_idx on staff_class_permissions (class_id);
