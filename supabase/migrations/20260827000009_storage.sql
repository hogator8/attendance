-- 生徒写真用のストレージバケットとポリシー

insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- 閲覧：バケットを公開設定にしているため誰でも読めるが、
-- アップロード・更新・削除は admin のみに制限する
create policy student_photos_read on storage.objects for select
  using (bucket_id = 'student-photos');

create policy student_photos_insert on storage.objects for insert
  with check (bucket_id = 'student-photos' and is_admin());

create policy student_photos_update on storage.objects for update
  using (bucket_id = 'student-photos' and is_admin())
  with check (bucket_id = 'student-photos' and is_admin());

create policy student_photos_delete on storage.objects for delete
  using (bucket_id = 'student-photos' and is_admin());
