# 出席管理システム（Phase 1）

日本語学校向けの出席管理Webサイト。Next.js（App Router）+ Supabase（PostgreSQL / Auth / Storage）+ Vercel を想定した構成。

## 技術スタック

- **Next.js 16**（App Router、Server Actions）
- **Supabase**：PostgreSQL・認証（Auth）・ファイルストレージ（Storage）
- **Tailwind CSS**
- **TypeScript**

## セットアップ

### 1. Supabaseプロジェクトを作成

1. [Supabase](https://supabase.com) でプロジェクトを作成する
2. プロジェクトの Settings > API から `Project URL`・`anon public key`・`service_role key` を控える

### 2. マイグレーションを適用

Supabase CLI を使って `supabase/migrations/` 以下のSQLを適用する。

```bash
npx supabase login
npx supabase link --project-ref <あなたのプロジェクトref>
npx supabase db push
```

マイグレーションでは以下を行っている（`supabase/migrations/` を参照）：

- 4章のテーブル定義（terms, students, classes, class_enrollments, elective_memberships,
  timetable_versions/slots, events関連, symbols, conversion_rules, color_rules,
  term_settings, holidays, attendance_records, event_attendance, staff,
  staff_class_permissions）
- Row Level Security（RLS）の有効化と、admin/teacher の権限に応じたポリシー
- 生徒写真用のストレージバケット（`student-photos`）

### 3. 環境変数を設定

`.env.local.example` を `.env.local` にコピーし、Supabaseの値を入力する。

```bash
cp .env.local.example .env.local
```

`SUPABASE_SERVICE_ROLE_KEY` はサーバー専用（教員アカウント作成に使用）。クライアントに公開しないこと。

### 4. 最初の管理者アカウントを作成

教員アカウントの作成は管理画面（教員管理）から行うが、最初の管理者アカウントだけは
Supabase側で手動作成する必要がある。

1. Supabaseダッシュボード > Authentication > Users で、管理者用のユーザーを作成する
   （メールアドレス・パスワードを設定し、Auto Confirm Userを有効にする）
2. Supabaseダッシュボード > SQL Editor で、作成したユーザーのUUIDを使い以下を実行する

```sql
insert into staff (id, name, email, role)
values ('<AuthユーザーのUUID>', '管理者氏名', 'admin@example.com', 'admin');
```

以降の教員アカウントは、この管理者でログインしたあとの「教員管理」画面から作成できる。

### 5. 依存関係のインストールと起動

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開く。

## 開発時のコマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm run lint     # ESLint
npm test         # 出席率計算ロジックのユニットテスト（node:test）
npx tsc --noEmit # 型チェック
```

## ディレクトリ構成（抜粋）

```
src/
  app/
    login/                 ログイン画面
    (app)/                 ログイン後の画面群（共通ナビゲーション付き）
      home/                ホーム画面
      settings/            設定（管理者のみ）：学期・出席記号・換算ルール・色分け・休業日・行事
      classes/             クラス管理（管理者のみ）：クラス作成・時間割
      students/            生徒管理（管理者のみ）
      staff/               教員管理（管理者のみ）
      attendance/          出席入力（コア機能）
      summary/             集計（月別・累計出席率）
  lib/
    supabase/              Supabaseクライアント（browser/server/admin）・DB型定義
    attendance/            出席率計算ロジック（calc.ts）とテスト
    auth.ts                ログイン中staffの取得・admin/staff権限チェック
    permissions.ts         staff_class_permissionsに基づくアクセス可能クラス判定
    roster.ts              日付時点でのクラス名簿（class_enrollments/elective_memberships）解決
    timetable.ts           選択科目の時間割からホームルームのis_elective_slotを同期
supabase/
  migrations/               DBスキーマ・RLSポリシーのSQLマイグレーション
```

## 出席率の計算ロジック

現行Excelマクロの `RunSummary` / `CalcConvertedAbsences` / `GetSymbolInfo` と同じ計算式を
`src/lib/attendance/calc.ts` に実装している（`calc.test.ts` に検証用のユニットテストあり）。

```
reqDays（要出席日数） = counts_as_required=true の記号が付いたレコード数の合計
                        （通常授業は1レコード=weight 1、学校行事はcredit_periodsをweightとして加算）
rawAbsCount（生の欠席数） = category='absence' のレコード数の合計（同様にweight加算）
convertedAbsences（遅刻早退の換算欠席数）
  = combined_n > 0 かつ 遅刻・早退の記号が両方定義されている場合：
      floor((遅刻回数 + 早退回数) / combined_n)
  = それ以外の場合：
      floor(遅刻回数 / late_n) + floor(早退回数 / early_n)
totalAbsences = rawAbsCount + convertedAbsences
出席率 = reqDays > 0 ? (reqDays - totalAbsences) / reqDays : 0
```

月別・累計どちらも同じ関数（`calculateAttendanceRate`）を使い、対象期間でフィルタした
レコードを渡すだけで計算される。集計画面には「集計実行」のような手動ボタンはなく、
表示のたびにリアルタイムで計算する。

## Phase 1 の対象外（Phase 2以降）

- 個票出力（PDF）
- 証明書発行（PDF）
- 所見（学生ごとの特記事項）管理画面
- 単発の時間割変更（振替授業など、日単位の一時的な変更UI）
- CSVによる生徒一括登録
- 学期またぎのデータ移行・Googleスプレッドシート連携
