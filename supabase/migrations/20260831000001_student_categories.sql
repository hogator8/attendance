-- 学生区分機能（長期生／短期生など）。
--
-- 学期ごとではなく、学校全体で共通の1セットとして保持する（school_settingsと
-- 同様、学期に依存しない永続データ）。出席記号設定と同様のUIで、最大10種類
-- まで登録できる想定。

create table student_categories (
  id uuid primary key default gen_random_uuid(),
  order_no integer not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  constraint student_categories_order_no_check check (order_no between 1 and 10)
);

alter table student_categories enable row level security;

-- 閲覧：ログイン中の教員なら誰でも参照可（terms/symbolsと同様の運用）
create policy student_categories_select on student_categories for select
  using (is_staff_member());

-- 編集：can_manage_settings（他の学期非依存の設定と同様の権限）
create policy student_categories_insert on student_categories for insert
  with check (is_admin() or has_permission('can_manage_settings'));
create policy student_categories_update on student_categories for update
  using (is_admin() or has_permission('can_manage_settings'))
  with check (is_admin() or has_permission('can_manage_settings'));
create policy student_categories_delete on student_categories for delete
  using (is_admin() or has_permission('can_manage_settings'));

-- students.category_id：1人につき1つだけ選択（任意）。student_categories側の
-- 行はon delete restrictとし、既に学生に割り当てられている区分をうっかり
-- 削除できないようにする（symbolsテーブルと同様の考え方）。
alter table students
  add column category_id uuid references student_categories (id) on delete restrict;
