-- RLSポリシーで使う共通ヘルパー関数
-- SECURITY DEFINER + search_path固定で、staff テーブル自体のRLSと循環しないようにする

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_staff_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where id = auth.uid());
$$;

-- p_need: 'input' または 'view'
create or replace function has_class_permission(p_class_id uuid, p_need text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from staff_class_permissions p
      where p.staff_id = auth.uid()
        and p.class_id = p_class_id
        and (
          (p_need = 'input' and p.can_input)
          or (p_need = 'view' and p.can_view_summary)
          or (p_need = 'any' and (p.can_input or p.can_view_summary))
        )
    );
$$;
