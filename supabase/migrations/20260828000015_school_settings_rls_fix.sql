-- 20260828000014のRLSポリシー不具合修正。
--
-- school_settings は select と update のポリシーしか定義していなかったが、
-- アプリ側は upsert()（内部的には insert ... on conflict (id) do update）で
-- 保存している。PostgreSQLのRLSは、on conflictで実際にはupdateになる場合でも
-- insert側のポリシー（with check）の通過を要求するため、insertポリシーが
-- 存在しないと「new row violates row-level security policy」で保存が
-- 常に失敗してしまっていた。
--
-- 他の設定系テーブル（term_settings等）と同じ「for all」パターンに統一する。

drop policy if exists school_settings_select on school_settings;
drop policy if exists school_settings_update on school_settings;

create policy school_settings_select on school_settings
  for select
  using (is_admin() or has_permission('can_view_individual_records'));

create policy school_settings_write on school_settings
  for all
  using (is_admin())
  with check (is_admin());
