-- historical_monthly_summaries に、出席記号設定の「集計区分」6区分のうち
-- 未対応だった「公欠」（excused）「除外」（excluded）に対応する列を追加する。
-- CSV取り込みテンプレートの列構成を、記号の集計区分と一対一対応させるため。

alter table historical_monthly_summaries
  add column excused_days integer not null default 0 check (excused_days >= 0);
alter table historical_monthly_summaries
  add column excluded_days integer not null default 0 check (excluded_days >= 0);
