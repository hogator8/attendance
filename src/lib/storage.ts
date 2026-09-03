import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const BUCKET = "student-photos";
// 一覧・詳細画面のサムネイル表示に十分な解像度に縮小する
// （リサイズ前の原寸画像をそのまま配信すると、一覧表示だけで
// 数百KB〜数MBの通信が学生数分発生してしまうため）。
const MAX_DIMENSION = 400;
const JPEG_QUALITY = 80;

export async function uploadStudentPhoto(
  supabase: Client,
  studentId: string,
  file: File,
): Promise<string> {
  const original = Buffer.from(await file.arrayBuffer());
  const resized = await sharp(original)
    .rotate() // Exifの向き情報を反映してから破棄する
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const path = `${studentId}/photo.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(`写真のアップロードに失敗しました: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // キャッシュ回避のためタイムスタンプを付与
  return `${data.publicUrl}?t=${Date.now()}`;
}

// 学生写真を削除する（未登録の状態に戻す）。photo_url側のnull更新は
// 呼び出し側（Server Action）の責務とし、ここではStorageオブジェクトの
// 削除のみを行う。
export async function deleteStudentPhotoFile(
  supabase: Client,
  studentId: string,
): Promise<void> {
  const path = `${studentId}/photo.jpg`;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`写真の削除に失敗しました: ${error.message}`);
}
