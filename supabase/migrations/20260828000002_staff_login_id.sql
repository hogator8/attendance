-- staff.login_id（メールアドレス形式に縛られないログインID）を追加する。
-- Supabase Auth は内部的にメールアドレス形式のアカウントを必要とするため、
-- login_id 入力時はサーバー側で `<login_id>@attendance.internal` のような
-- 実際には送信されない内部専用ダミーメールアドレスを生成し、それを
-- Supabase Auth の email として登録する（staff.email は今後 Auth 側のダミー
-- メールアドレスと同じ値を保持する）。
--
-- 既存アカウントは移行不要とし、現在の email をそのまま login_id として使う。

alter table staff add column login_id text;
update staff set login_id = email where login_id is null;
alter table staff alter column login_id set not null;
alter table staff add constraint staff_login_id_key unique (login_id);

-- employment_type（表示用ラベル）は role に統合されたため削除する
alter table staff drop column employment_type;
