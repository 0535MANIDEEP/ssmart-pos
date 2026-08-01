import { enqueue } from "./offline-store";

const API_URL = "/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function isOfflineError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0;
  if (err instanceof TypeError) return err.message.includes("fetch");
  return false;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const method = init?.method || "GET";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      signal: AbortSignal.timeout(20_000),
      headers: isFormData
        ? { ...(init?.headers || {}) }
        : { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError("Request timed out — check your connection and try again", 0);
    }
    throw new ApiError("Network error — check your connection and try again", 0);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    throw new ApiError(body?.error || res.statusText, res.status, body?.details);
  }

  return body as T;
}

async function requestWithOfflineQueue<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method || "GET";
  const isMutation = method !== "GET";

  // If offline and it's a mutation, queue it
  if (isMutation && !navigator.onLine) {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    await enqueue({
      type: method === "POST" ? "invoice" : "product-update",
      payload: { method, path, body },
    });
    // Return a synthetic success so the UI can proceed
    return { success: true, offline: true, queued: true } as unknown as T;
  }

  // Try the network
  try {
    return await request<T>(path, init);
  } catch (err) {
    // If it's a mutation and we're offline (network error), queue it
    if (isMutation && isOfflineError(err)) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      await enqueue({
        type: method === "POST" ? "invoice" : "product-update",
        payload: { method, path, body },
      });
      return { success: true, offline: true, queued: true } as unknown as T;
    }
    throw err;
  }
}

export function describeApiError(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError && isOfflineError(err)) {
    return "You are offline — action saved and will sync when connected";
  }
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details as { formErrors?: string[]; fieldErrors?: Record<string, string[]> } | undefined;
  const parts = [...(details?.formErrors ?? [])];
  for (const [field, msgs] of Object.entries(details?.fieldErrors ?? {})) {
    for (const m of msgs ?? []) parts.push(`${field}: ${m}`);
  }
  return parts.length > 0 ? `${err.message} — ${parts.join("; ")}` : err.message;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    requestWithOfflineQueue<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    requestWithOfflineQueue<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) =>
    requestWithOfflineQueue<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) =>
    requestWithOfflineQueue<T>(path, { method: "POST", body: formData }),
};
