"use client";

import { useCallback, useState } from "react";

import { type ToastItem } from "./toast.js";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast-${counter}`;
}

export interface UseToastResult {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

/** Локальный стейт-хук тостов (без глобального стора — Фаза 1). */
export function useToast(): UseToastResult {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">): string => {
    const id = nextId();
    setToasts((prev) => [...prev, { ...item, id }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}
