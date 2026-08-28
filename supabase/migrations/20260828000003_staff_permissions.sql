-- staff_permissions（機能単位の全体権限：クラスに紐づかない）
-- staff_class_permissions（クラス単位の出席入力可否）と組み合わせて、
-- 教員のアクセス範囲を決定する。admin は常にフルアクセス（このテーブルの
-- 内容に関わらず、is_admin() が優先される）。

create table staff_permissions (
  staff_id uuid primary key references staff (id) on delete cascade,
  can_view_summary boolean not null default false,
  can_manage_students boolean not null default false,
  can_manage_classes boolean not null default false,
  can_manage_staff boolean not null default false,
  can_manage_settings boolean not null default false,
  can_view_individual_records boolean not null default false
);

-- 既存の全staffに対して、全項目falseの行を作成しておく
insert into staff_permissions (staff_id)
select id from staff
on conflict (staff_id) do nothing;

alter table staff_permissions enable row level security;

create policy staff_permissions_select on staff_permissions for select
  using (is_admin() or staff_id = auth.uid());
create policy staff_permissions_write on staff_permissions for all
  using (is_admin()) with check (is_admin());
