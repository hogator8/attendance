-- 学期のアクティブ状態は、いつでもON/OFFを切り替えられ、複数学期を同時に
-- アクティブにできるようにする。これまでは terms_single_active_idx により
-- 同時にアクティブな学期を1つに制限していたが、この制約を撤廃する。

drop index if exists terms_single_active_idx;
