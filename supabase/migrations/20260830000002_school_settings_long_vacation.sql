-- 証明書ページに追加する「長期休暇」欄（#追加要望③）。
-- 発行者情報と同様、証明書発行の都度入力するのではなく、あらかじめ内容を
-- 保存しておき、証明書発行時の初期値として使い回せるようにする。

alter table school_settings add column long_vacation text not null default '';
