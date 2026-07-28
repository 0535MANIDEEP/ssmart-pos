import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import {
  saveDraft as saveDraftBackend,
  loadDrafts as loadDraftsBackend,
  deleteDraft as deleteDraftBackend,
} from "@/lib/drafts";
import {
  saveDraftLocal,
  loadDraftsLocal,
  deleteDraftLocal,
} from "@/lib/drafts-local";
import type { CartItem } from "@/lib/types";

export type { CartItem };

interface BillManagerState {
  cartItems: CartItem[];
  customerName: string;
  customerPhone: string;
  discountType: "percent" | "amount" | null;
  discountValue: number;
  paymentMethod: "CASH" | "UPI" | "CARD";
  pointsRedeemed: number;
  creditApplied: number;
  duePaid: number;
  returns: any[];
}

interface UseBillManagerReturn {
  bill: BillManagerState;
  setCartItem: (productId: number, quantity: number, product: any) => void;
  removeCartItem: (productId: number) => void;
  clearCart: () => void;
  setCustomer: (name: string, phone: string) => void;
  setDiscount: (type: "percent" | "amount" | null, value: number) => void;
  setPaymentMethod: (method: "CASH" | "UPI" | "CARD") => void;
  setPointsRedeemed: (points: number) => void;
  setCreditApplied: (amount: number) => void;
  setDuePaid: (amount: number) => void;
  addReturn: (returnData: any) => void;
  removeReturn: (index: number) => void;
  hasDraft: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<void>;
  deleteDraft: () => Promise<void>;
}

const EMPTY_BILL: BillManagerState = {
  cartItems: [],
  customerName: "",
  customerPhone: "",
  discountType: null,
  discountValue: 0,
  paymentMethod: "CASH",
  pointsRedeemed: 0,
  creditApplied: 0,
  duePaid: 0,
  returns: [],
};

function generateBillId(): string {
  return `bill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function useBillManager(): UseBillManagerReturn {
  const [bill, setBill] = useState<BillManagerState>(EMPTY_BILL);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const billIdRef = useRef<string>(generateBillId());
  const draftDbIdRef = useRef<number | null>(null);
  const draftLabelRef = useRef<string>("Current Bill");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billRef = useRef(bill);
  const mountedRef = useRef(false);

  billRef.current = bill;

  const persist = useCallback(async (state: BillManagerState) => {
    setIsSaving(true);
    const payload = { ...state };
    const label = draftLabelRef.current;

    let backendOk = false;
    try {
      await saveDraftBackend(billIdRef.current, label, payload);
      backendOk = true;
    } catch {
      // fallback to local
    }

    try {
      await saveDraftLocal({
        id: draftDbIdRef.current ?? 0,
        billId: billIdRef.current,
        label,
        isHeld: false,
        state: payload as unknown as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // local save also failed
    }

    if (backendOk) {
      try {
        const all = await loadDraftsBackend();
        const match = all.find((d) => d.billId === billIdRef.current);
        if (match) draftDbIdRef.current = match.id;
      } catch {
        // ignore
      }
    }

    setLastSaved(new Date());
    setIsSaving(false);
  }, []);

  const saveDraft = useCallback(async () => {
    await persist(billRef.current);
  }, [persist]);

  const loadDraft = useCallback(async () => {
    let draftState: BillManagerState | null = null;
    let foundDbId: number | null = null;

    try {
      const all = await loadDraftsBackend();
      const match = all.find((d) => d.billId === billIdRef.current);
      if (match) {
        draftState = match.state as unknown as BillManagerState;
        foundDbId = match.id;
      }
    } catch {
      // try local
    }

    if (!draftState) {
      try {
        const allLocal = await loadDraftsLocal();
        const matchLocal = allLocal.find(
          (d) => d.billId === billIdRef.current,
        );
        if (matchLocal) {
          draftState = matchLocal.state as unknown as BillManagerState;
          foundDbId = matchLocal.id;
        }
      } catch {
        // no draft available
      }
    }

    if (draftState) {
      setBill(draftState);
      draftDbIdRef.current = foundDbId;
      setHasDraft(true);
    }
  }, []);

  const deleteDraft = useCallback(async () => {
    if (draftDbIdRef.current !== null) {
      try {
        await deleteDraftBackend(draftDbIdRef.current);
      } catch {
        // ignore
      }
      try {
        await deleteDraftLocal(draftDbIdRef.current);
      } catch {
        // ignore
      }
      draftDbIdRef.current = null;
    }
    setHasDraft(false);
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadDraft().then(() => {
      mountedRef.current = true;
    });
  }, [loadDraft]);

  // Auto-save on state change (debounced 2s), only after mount load completes
  useEffect(() => {
    if (!mountedRef.current) return;

    setHasDraft(
      bill.cartItems.length > 0 ||
        bill.customerName !== "" ||
        bill.customerPhone !== "",
    );

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      persist(bill);
    }, 2000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [bill, persist]);

  const setCartItem = useCallback(
    (productId: number, quantity: number, product: any) => {
      setBill((prev) => {
        const existing = prev.cartItems.find(
          (item) => item.product.id === productId,
        );
        if (quantity <= 0) {
          return {
            ...prev,
            cartItems: prev.cartItems.filter(
              (item) => item.product.id !== productId,
            ),
          };
        }
        if (existing) {
          return {
            ...prev,
            cartItems: prev.cartItems.map((item) =>
              item.product.id === productId
                ? { ...item, quantity }
                : item,
            ),
          };
        }
        return {
          ...prev,
          cartItems: [...prev.cartItems, { product, quantity }],
        };
      });
    },
    [],
  );

  const removeCartItem = useCallback((productId: number) => {
    setBill((prev) => ({
      ...prev,
      cartItems: prev.cartItems.filter((item) => item.product.id !== productId),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setBill((prev) => ({
      ...prev,
      cartItems: [],
      customerName: "",
      customerPhone: "",
      discountType: null,
      discountValue: 0,
      paymentMethod: "CASH",
      pointsRedeemed: 0,
      creditApplied: 0,
      duePaid: 0,
      returns: [],
    }));
  }, []);

  const setCustomer = useCallback((name: string, phone: string) => {
    setBill((prev) => ({
      ...prev,
      customerName: name,
      customerPhone: phone,
    }));
  }, []);

  const setDiscount = useCallback(
    (type: "percent" | "amount" | null, value: number) => {
      setBill((prev) => ({
        ...prev,
        discountType: type,
        discountValue: value,
      }));
    },
    [],
  );

  const setPaymentMethod = useCallback((method: "CASH" | "UPI" | "CARD") => {
    setBill((prev) => ({ ...prev, paymentMethod: method }));
  }, []);

  const setPointsRedeemed = useCallback((points: number) => {
    setBill((prev) => ({ ...prev, pointsRedeemed: points }));
  }, []);

  const setCreditApplied = useCallback((amount: number) => {
    setBill((prev) => ({ ...prev, creditApplied: amount }));
  }, []);

  const setDuePaid = useCallback((amount: number) => {
    setBill((prev) => ({ ...prev, duePaid: amount }));
  }, []);

  const addReturn = useCallback((returnData: any) => {
    setBill((prev) => ({
      ...prev,
      returns: [...prev.returns, returnData],
    }));
  }, []);

  const removeReturn = useCallback((index: number) => {
    setBill((prev) => ({
      ...prev,
      returns: prev.returns.filter((_, i) => i !== index),
    }));
  }, []);

  return {
    bill,
    setCartItem,
    removeCartItem,
    clearCart,
    setCustomer,
    setDiscount,
    setPaymentMethod,
    setPointsRedeemed,
    setCreditApplied,
    setDuePaid,
    addReturn,
    removeReturn,
    hasDraft,
    isSaving,
    lastSaved,
    saveDraft,
    loadDraft,
    deleteDraft,
  };
}
