-- 出席記号設定（symbols）の編集・保存で発生していた不具合の修正の一部。
--
-- これまでの保存処理は「学期の記号を全削除してから作り直す」方式だったが、
-- attendance_records.symbol_id / event_attendance.symbol_id は
-- symbols(id) を ON DELETE RESTRICT で参照しているため、既に出席記録で
-- 使用されている記号を削除しようとすると外部キー制約違反でエラーになって
-- いた（本番ビルドではReact error #441としてしか見えない）。
--
-- 対応として、保存処理を「行を作り直す」のではなく「既存行をUPDATE、
-- 新規行のみINSERT」に変更する（アプリ側で対応）。この場合、2つの記号の
-- 記号文字（例：○と×）を入れ替えるような保存を1回のupsertで行うと、
-- (term_id, symbol_char) のUNIQUE制約が行単位でチェックされるため、
-- 最終的な状態では重複していなくても、処理途中の一時的な重複でエラーに
-- なってしまう。この制約をDEFERRABLE INITIALLY DEFERREDにし、
-- チェックをトランザクション（＝1回の保存リクエスト）の最後にまとめて
-- 行うことで、記号の入れ替えも問題なく保存できるようにする。

alter table symbols drop constraint symbols_term_id_symbol_char_key;
alter table symbols add constraint symbols_term_id_symbol_char_key
  unique (term_id, symbol_char) deferrable initially deferred;
