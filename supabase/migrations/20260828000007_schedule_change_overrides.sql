-- schedule_change_overrides（単発の時間割変更：振替授業等）
--
-- 特定クラス・特定日・特定時限について、通常の時間割（timetable_slots）の
-- 科目・担当者名を一時的に上書きする。出席入力・集計計算の際は、該当日・
-- 時限のオーバーライドがあれば優先して表示に使う。ただし、必要出席日数
-- （reqDays）のカウント方法には影響しない（表示上の科目・担当者名の
-- 上書きのみで、出席が必要な時限であること自体は変わらない）。

create table schedule_change_overrides (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  date date not null,
  period_no integer not null check (period_no > 0),
  subject text,
  teacher_name text,
  note text,
  created_at timestamptz not null default now(),
  unique (class_id, date, period_no)
);

create index schedule_change_overrides_class_date_idx
  on schedule_change_overrides (class_id, date);
