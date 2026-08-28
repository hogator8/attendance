-- attendance_records に、遅刻・早退の時刻（任意）と、出席以外を選択した際の
-- 理由（任意）を記録できるようにする。判定は symbols.category ベースで行うため
-- （特定の記号名をハードコードしない）、ここではカラムを追加するのみで
-- category による入力可否の制御はアプリケーション側で行う。

alter table attendance_records add column time_value time;
alter table attendance_records add column reason text;
