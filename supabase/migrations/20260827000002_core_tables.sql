-- コアテーブル：terms（学期）、staff（教員）、students（生徒マスタ）、classes（クラス）

-- ============================================================
-- terms（学期）
-- ============================================================
create table terms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint terms_date_check check (start_date < end_date)
);

-- 同時にアクティブな学期は1つのみ
create unique index terms_single_active_idx on terms (is_active) where is_active;

-- ============================================================
-- staff（教員・事務スタッフ）：Supabase Auth の user id と1対1で紐付く
-- ============================================================
create table staff (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role staff_role not null default 'teacher',
  employment_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_set_updated_at
  before update on staff
  for each row execute function set_updated_at();

-- ============================================================
-- students（生徒マスタ）※学期をまたいで永続化
-- ============================================================
create table students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique,
  name text not null,
  furigana text not null,
  photo_url text,
  enrollment_date date not null,
  status student_status not null default 'enrolled',
  status_date date,
  status_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_status_date_check check (
    (status = 'enrolled' and status_date is null) or (status <> 'enrolled')
  )
);

create index students_status_idx on students (status);
create index students_name_idx on students (name);

create trigger students_set_updated_at
  before update on students
  for each row execute function set_updated_at();

-- ============================================================
-- classes（出席グループ：ホームルームクラス／選択科目）
-- ============================================================
create table classes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms (id) on delete cascade,
  name text not null,
  type class_type not null,
  created_at timestamptz not null default now()
);

create index classes_term_idx on classes (term_id);
create index classes_type_idx on classes (type);
