-- 選択科目（elective_memberships）にも、ホームルーム（class_enrollments）と
-- 同様の「出席番号」列を追加する。出席入力ページの並び順で、出席番号が
-- 設定されている学生を優先して使うため。

alter table elective_memberships
  add column seq_no integer;
