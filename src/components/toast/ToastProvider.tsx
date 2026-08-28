"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// フォーム保存など、アプリ全体の操作結果を通知する共通のトースト表示。
// 「保存」ボタンがある全画面で同じ見た目・挙動になるよう、この一箇所に集約する。
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast は ToastProvider の内側で使用してください。");
  }
  return ctx;
}

const DISPLAY_MS = 4000;
const FLASH_PARAM = "flash";

// redirect()を伴うServer Action（新規作成後に詳細ページへ遷移する等）は、
// 遷移元のページでトーストを表示する機会がない（redirect()以降のコードは
// 実行されないため）。遷移先URLに ?flash=メッセージ を付与しておくことで、
// 遷移後にこのコンポーネントが検知してトーストを表示し、URLからパラメータを
// 取り除く。
function FlashToastListener() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flashMessage = searchParams.get(FLASH_PARAM);

  useEffect(() => {
    if (!flashMessage) return;
    toast.success(flashMessage);
    const params = new URLSearchParams(searchParams);
    params.delete(FLASH_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // flashMessage の有無だけを見て一度だけ実行したいため、
    // toast/router/pathname/searchParams はあえて依存に含めない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashMessage]);

  return null;
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), DISPLAY_MS);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    success: (message) => push(message, "success"),
    error: (message) => push(message, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      <Suspense fallback={null}>
        <FlashToastListener />
      </Suspense>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto max-w-md rounded-md px-4 py-2 text-sm text-white shadow-lg ${
              t.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
