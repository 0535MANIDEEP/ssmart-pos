import { useEffect, useRef, useCallback } from "react";
import { saveDraft } from "@/lib/drafts";
import { saveDraftLocal } from "@/lib/drafts-local";

export function useAutoSave(
  billId: string,
  state: Record<string, unknown> | null,
  isHeld: boolean,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const flush = useCallback(async () => {
    if (!state || !billId) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSavedRef.current) return;

    try {
      await saveDraft(billId, billId, state, isHeld);
      lastSavedRef.current = serialized;
    } catch {
      await saveDraftLocal({
        id: 0,
        billId,
        label: billId,
        isHeld,
        state,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [billId, state, isHeld]);

  useEffect(() => {
    if (!state) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, flush]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [flush]);

  return { flush };
}
