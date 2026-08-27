-- 学校行事関連テーブル

create table events (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms (id) on delete cascade,
  name text not null,
  date_from date not null,
  date_to date not null,
  credit_periods numeric not null default 0,
  replace_mode event_replace_mode not null default 'none',
  created_at timestamptz not null default now(),
  constraint events_date_check check (date_from <= date_to)
);

create index events_term_idx on events (term_id);
create index events_date_idx on events (date_from, date_to);

-- replace_mode = 'partial' の場合のみ使用：置き換え対象の時限
create table event_replaced_periods (
  event_id uuid not null references events (id) on delete cascade,
  period_no integer not null check (period_no > 0),
  primary key (event_id, period_no)
);

-- 対象クラス（行に何もなければ「全クラス」対象として扱う）
create table event_classes (
  event_id uuid not null references events (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  primary key (event_id, class_id)
);

create index event_classes_class_idx on event_classes (class_id);

-- event_id を指定すると、対象クラスの id 一覧を返す
-- event_classes に行がなければ「全クラス対象」として全クラスを返す
create or replace function event_applicable_classes(p_event_id uuid)
returns table (class_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (select 1 from event_classes ec where ec.event_id = p_event_id) then
    return query select ec.class_id from event_classes ec where ec.event_id = p_event_id;
  else
    return query select c.id from classes c;
  end if;
end;
$$;
