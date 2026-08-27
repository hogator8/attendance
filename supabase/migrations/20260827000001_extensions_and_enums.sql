-- 拡張機能・ENUM型定義

create extension if not exists "btree_gist";

create type student_status as enum ('enrolled', 'graduated', 'withdrawn');
create type class_type as enum ('homeroom', 'elective');
create type symbol_category as enum ('attendance', 'absence', 'late', 'early_leave', 'excused', 'excluded');
create type event_replace_mode as enum ('all', 'partial', 'none');
create type staff_role as enum ('admin', 'teacher');

-- updated_at を自動更新する共通トリガー関数
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
