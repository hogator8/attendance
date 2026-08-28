-- 証明書発行機能（#04指示書 ④）の発行者情報（学校名・住所・電話番号・校長名）。
-- 発行の都度入力するのではなく、証明書タブ内で編集・保存して使い回す想定のため
-- 単一行（シングルトン）で保持する。

create table school_settings (
  id integer primary key default 1,
  school_name text not null default '',
  school_address text not null default '',
  school_phone text not null default '',
  principal_name text not null default '',
  updated_at timestamptz not null default now(),
  constraint school_settings_singleton check (id = 1)
);

insert into school_settings (id) values (1);

create trigger school_settings_set_updated_at
  before update on school_settings
  for each row execute function set_updated_at();

alter table school_settings enable row level security;

-- 閲覧：出席状況の個別閲覧権限（証明書タブの閲覧権限と同じ）を持つ職員なら誰でも参照可
create policy school_settings_select on school_settings
  for select
  using (is_admin() or has_permission('can_view_individual_records'));

-- 編集：admin のみ（他の「設定」画面と同様の運用に合わせる）
create policy school_settings_update on school_settings
  for update
  using (is_admin())
  with check (is_admin());
