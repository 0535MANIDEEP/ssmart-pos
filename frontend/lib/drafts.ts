import { api } from "./api";

export interface DraftBill {
  id: number;
  billId: string | null;
  label: string;
  isHeld: boolean;
  state: Record<string, unknown>;
  updatedAt: string;
}

export async function loadDrafts(): Promise<DraftBill[]> {
  return api.get<DraftBill[]>("/bills/draft");
}

export async function saveDraft(
  billId: string,
  label: string,
  state: Record<string, unknown>,
  isHeld = false,
): Promise<void> {
  await api.post("/bills/draft", { billId, label, state, isHeld });
}

export async function deleteDraft(id: number): Promise<void> {
  await api.delete(`/bills/draft/${id}`);
}

export async function holdDraft(id: number): Promise<void> {
  await api.post(`/bills/draft/${id}/hold`);
}

export async function recallDraft(id: number): Promise<void> {
  await api.post(`/bills/draft/${id}/recall`);
}
