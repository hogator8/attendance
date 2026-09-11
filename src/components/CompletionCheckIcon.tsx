// 出席入力が完了していることを示す、緑の塗りつぶし円＋白チェックマークの
// アイコン。プロジェクトに外部アイコンライブラリの導入実績がなく、既存の
// アイコン（src/components/Nav.tsx）もすべて手書きのインラインSVGのため、
// それに合わせた実装にしている。
export default function CompletionCheckIcon({
  className,
  title = "入力完了",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className ?? "h-5 w-5"}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="10" cy="10" r="9" fill="#16a34a" />
      <path
        d="M6 10.3l2.6 2.6L14.2 7"
        fill="none"
        stroke="white"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
