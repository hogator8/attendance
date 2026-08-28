-- historical_monthly_summaries（過去の出席データ：月別集計の取り込み）
--
-- CSV取り込み機能（標準パターン）で使用。日次データを持たず、学生×年月ごとの
-- 集計値のみを保持する。集計画面の「累計出席率」（入学からの通算出席率）の
-- 計算にはこのテーブルの値を合算し、月別出席率の表示にもそのまま反映する
-- （日次ドリルダウンは行わない）。
--
-- year_month は月初日（例：2026-04-01）で統一し、YYYY-MM 単位の一意性を保つ。

create table historical_monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  year_month date not null,
  required_days integer not null default 0 check (required_days >= 0),
  attended_days integer not null default 0 check (attended_days >= 0),
  absent_days integer not null default 0 check (absent_days >= 0),
  late_count integer not null default 0 check (late_count >= 0),
  early_leave_count integer not null default 0 check (early_leave_count >= 0),
  created_at timestamptz not null default now(),
  unique (student_id, year_month),
  constraint historical_monthly_summaries_year_month_check
    check (year_month = date_trunc('month', year_month)::date)
);

create index historical_monthly_summaries_student_idx
  on historical_monthly_summaries (student_id);
