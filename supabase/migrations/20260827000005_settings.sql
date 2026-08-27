-- 学期ごとの各種設定：出席記号、換算ルール、色分けルール、休業日、小数点桁数

-- ============================================================
-- symbols（出席記号）※学期ごと・最大10種類
-- ============================================================
create table symbols (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms (id) on delete cascade,
  order_no integer not null check (order_no between 1 and 10),
  symbol_char text not null,
  label text not null,
  category symbol_category not null,
  counts_as_required boolean not null default true,
  is_late_early_target boolean not null default false,
  unique (term_id, order_no),
  unique (term_id, symbol_char)
);

create index symbols_term_idx on symbols (term_id);

-- ============================================================
-- conversion_rules（遅刻早退→欠席換算ルール）※学期に1行
-- ============================================================
create table conversion_rules (
  term_id uuid primary key references terms (id) on delete cascade,
  late_n integer not null default 0 check (late_n >= 0),
  early_n integer not null default 0 check (early_n >= 0),
  combined_n integer not null default 0 check (combined_n >= 0)
);

-- ============================================================
-- color_rules（出席率の色分け・最大5段階）
-- ============================================================
create table color_rules (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms (id) on delete cascade,
  tier_no integer not null check (tier_no between 1 and 5),
  lower_pct numeric not null,
  upper_pct numeric not null,
  color_hex text not null,
  label text,
  unique (term_id, tier_no),
  constraint color_rules_range_check check (lower_pct <= upper_pct)
);

create index color_rules_term_idx on color_rules (term_id);

-- ============================================================
-- 学期ごとの表示設定（出席率の小数点桁数）
-- ============================================================
create table term_settings (
  term_id uuid primary key references terms (id) on delete cascade,
  percent_decimal_digits integer not null default 1 check (percent_decimal_digits between 0 and 2)
);

-- ============================================================
-- holidays（休業日）※件数上限なし
-- ============================================================
create table holidays (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms (id) on delete cascade,
  date date not null,
  label text not null,
  color_hex text,
  unique (term_id, date)
);

create index holidays_term_idx on holidays (term_id);
create index holidays_date_idx on holidays (date);
