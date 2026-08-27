-- 所属履歴・時間割テーブル

-- ============================================================
-- class_enrollments（学生のホームルーム所属履歴：クラス異動対応）
-- ============================================================
create table class_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  seq_no integer,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint class_enrollments_date_check check (valid_to is null or valid_from <= valid_to),
  -- 同一学生が同時期に複数のホームルームへ重複所属することを防ぐ
  exclude using gist (
    student_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create index class_enrollments_class_idx on class_enrollments (class_id);
create index class_enrollments_student_idx on class_enrollments (student_id);

-- ============================================================
-- elective_memberships（選択科目の所属）
-- ============================================================
create table elective_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint elective_memberships_date_check check (valid_to is null or valid_from <= valid_to),
  -- 同一学生・同一選択科目での重複所属期間を防ぐ（別の選択科目への同時所属は可）
  exclude using gist (
    student_id with =,
    class_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create index elective_memberships_class_idx on elective_memberships (class_id);
create index elective_memberships_student_idx on elective_memberships (student_id);

-- ============================================================
-- timetable_versions（時間割バージョン：年度途中の変更対応）
-- ============================================================
create table timetable_versions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  constraint timetable_versions_date_check check (effective_to is null or effective_from <= effective_to),
  exclude using gist (
    class_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);

create index timetable_versions_class_idx on timetable_versions (class_id);

-- ============================================================
-- timetable_slots（曜日×時限ごとのコマ）
-- ============================================================
create table timetable_slots (
  id uuid primary key default gen_random_uuid(),
  timetable_version_id uuid not null references timetable_versions (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  period_no integer not null check (period_no > 0),
  period_label text not null,
  subject text not null,
  teacher_name text,
  is_elective_slot boolean not null default false,
  unique (timetable_version_id, day_of_week, period_no)
);

create index timetable_slots_version_idx on timetable_slots (timetable_version_id);
create index timetable_slots_day_period_idx on timetable_slots (day_of_week, period_no);
