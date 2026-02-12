"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const TOAST_DURATION_MS = 4000;

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { showSuccess: () => {}, showError: (m: string) => alert(m) };
  return ctx;
}

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => setItems([]), []);

  const scheduleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(dismiss, TOAST_DURATION_MS);
  }, [dismiss]);

  useEffect(() => {
    if (items.length > 0) scheduleDismiss();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, scheduleDismiss]);

  const showSuccess = useCallback((message: string) => {
    idRef.current += 1;
    setItems([{ id: idRef.current, message, type: "success" }]);
  }, []);

  const showError = useCallback((message: string) => {
    idRef.current += 1;
    setItems([{ id: idRef.current, message, type: "error" }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      {items.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-lg animate-toast-in ${
                item.type === "success"
                  ? "border-emerald-500 bg-white"
                  : "border-red-300 bg-white"
              }`}
            >
              {item.type === "success" ? (
                <span className="text-xl" aria-hidden>✓</span>
              ) : (
                <span className="text-xl text-red-600" aria-hidden>!</span>
              )}
              <p className={`text-sm font-medium ${item.type === "success" ? "text-[#134e4a]" : "text-red-700"}`}>
                {item.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
