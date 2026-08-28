-- staff.role を admin / teacher の2値から admin / full_time / part_time の3値に変更する。
-- 既存の 'teacher' はそのまま 'full_time'（専任）として扱う。
-- ENUM値の追加は他の変更と同じトランザクションで使えない場合があるため、
-- このファイル単体で完結させる。

alter type staff_role rename value 'teacher' to 'full_time';
alter type staff_role add value 'part_time';
