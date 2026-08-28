-- 単位数（時限あたりの単位）設定（#04指示書 ⑧）。
-- 出席入力は引き続き時限単位で行うが、集計・証明書発行等で「時間数」として
-- 表示する際に、時限数 × この値 で換算する。学期ごとに保持する。

alter table term_settings
  add column credit_hours_per_period numeric not null default 1
  check (credit_hours_per_period > 0);
