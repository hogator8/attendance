-- ログインID方式のログイン対応：
-- Supabase Auth は内部的にメールアドレス形式のアカウントを必要とするため、
-- ログイン画面では login_id のみを入力させ、サーバー側（未ログイン状態）で
-- login_id に対応する Auth 用メールアドレス（staff.email）を引いてから
-- signInWithPassword() に渡す。
--
-- staff テーブルは未ログインの状態からは通常読み取れない（RLSで保護されている）
-- ため、ログイン専用の SECURITY DEFINER 関数として提供する。パスワードその他の
-- 機微情報は一切返さず、login_id に対応する email のみを返す。

create or replace function staff_login_email(p_login_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from staff where login_id = p_login_id;
$$;

revoke all on function staff_login_email(text) from public;
grant execute on function staff_login_email(text) to anon, authenticated;
