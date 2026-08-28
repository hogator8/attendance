-- 証明書発行機能（#04指示書 ④）で必要な学生ごとの項目を追加する。
-- 性別・生年月日は任意項目。卒業予定年月日も学生ごとに個別に持つ値のため
-- students テーブルに追加する（証明書発行時にそのまま参照する）。

alter table students add column gender text;
alter table students add column date_of_birth date;
alter table students add column expected_graduation_date date;
