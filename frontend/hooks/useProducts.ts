"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

export interface ProductInput {
  barcode: string;
  name: string;
  category?: string;
  hsn?: string;
  unit?: string;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  taxRate: number;
  discountType?: "percent" | "amount" | null;
  discountValue?: number;
  stock: number;
}

export function useProducts(search = "", category = "") {
  return useQuery({
    queryKey: ["products", search, category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      const qs = params.toString();
      return api.get<Product[]>(`/products${qs ? `?${qs}` : ""}`);
    },
    staleTime: 10_000, // Don't refetch within 10 seconds
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: ["products", "low-stock"],
    queryFn: () => api.get<{ threshold: number; products: Product[] }>("/products/low-stock"),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductInput) => api.post<Product>("/products", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductInput> }) =>
      api.put<Product>(`/products/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}