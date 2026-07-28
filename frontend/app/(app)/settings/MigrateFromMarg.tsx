"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface MigratePreview {
  headers: string[];
  detectedMapping: Record<string, string>;
  preview: Record<string, any>[];
  totalRows: number;
}

interface MigrateResult {
  imported: number;
  skipped: number;
  errors: { row: Record<string, any>; error: string }[];
  total: number;
}

type MigrateType = "products" | "customers" | "ledgers";

const FIELD_OPTIONS: Record<MigrateType, { value: string; label: string }[]> = {
  products: [
    { value: "name", label: "Name" },
    { value: "barcode", label: "Barcode" },
    { value: "sellingPrice", label: "Selling Price" },
    { value: "purchasePrice", label: "Purchase Price" },
    { value: "taxRate", label: "Tax Rate" },
    { value: "hsn", label: "HSN" },
    { value: "stock", label: "Stock" },
    { value: "unit", label: "Unit" },
    { value: "category", label: "Category" },
    { value: "batch", label: "Batch" },
    { value: "expiry", label: "Expiry" },
  ],
  customers: [
    { value: "name", label: "Name" },
    { value: "phone", label: "Phone" },
    { value: "email", label: "Email" },
    { value: "address", label: "Address" },
    { value: "state", label: "State" },
    { value: "pincode", label: "Pincode" },
  ],
  ledgers: [
    { value: "name", label: "Name" },
    { value: "accountGroup", label: "Account Group" },
    { value: "openingBalance", label: "Opening Balance" },
    { value: "phone", label: "Phone" },
    { value: "address", label: "Address" },
    { value: "state", label: "State" },
    { value: "email", label: "Email" },
  ],
};

const TYPE_LABELS: Record<MigrateType, string> = {
  products: "Products",
  customers: "Customers",
  ledgers: "Ledgers",
};

export default function MigrateFromMarg() {
  const [step, setStep] = useState(1);
  const [migrateType, setMigrateType] = useState<MigrateType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<MigratePreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MigrateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStep(1);
    setMigrateType(null);
    setFile(null);
    setPreviewData(null);
    setMapping({});
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const handleTypeSelect = (type: MigrateType) => {
    setMigrateType(type);
    setStep(2);
  };

  const handleFileSelect = (selected: File) => {
    setFile(selected);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  const handleUpload = async () => {
    if (!file || !migrateType) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", migrateType);
      const data = await api.upload<MigratePreview>("/migrate/preview", formData);
      setPreviewData(data);
      setMapping(data.detectedMapping);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!migrateType || !previewData) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<MigrateResult>("/migrate/import", {
        type: migrateType,
        mapping,
        rows: previewData.preview,
      });
      setResult(data);
      setStep(5);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Type", "Upload", "Map", "Preview", "Import"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        Migrate from MARG ERP
      </h1>
      <p className="text-sm text-foreground/60">
        Import your product, customer, or ledger data from MARG ERP into SS Mart POS.
      </p>

      <div className="flex items-center gap-2">
        {steps.map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : num}
              </div>
              <span
                className={`text-xs ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </span>
              {i < steps.length - 1 && (
                <div className="mx-1 h-px w-4 bg-border" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Choose data type
          </h2>
          <p className="mb-6 text-sm text-foreground/60">
            Select the type of data you want to migrate from MARG.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(Object.keys(TYPE_LABELS) as MigrateType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                className="rounded-lg border border-border p-6 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <h3 className="font-medium text-foreground">{TYPE_LABELS[type]}</h3>
                <p className="mt-1 text-xs text-foreground/60">
                  {FIELD_OPTIONS[type].length} fields available
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Upload Excel file
          </h2>
          <p className="mb-6 text-sm text-foreground/60">
            Upload an Excel (.xlsx/.xls) or CSV file exported from MARG ERP.
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : file
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/50"
            }`}
          >
            {file ? (
              <div className="text-center">
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="mt-1 text-xs text-foreground/60">
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-foreground/60">
                  Drag & drop your file here, or{" "}
                  <span className="font-medium text-primary">browse</span>
                </p>
                <p className="mt-1 text-xs text-foreground/40">
                  Supports .xlsx, .xls, .csv
                </p>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFileSelect(selected);
              }}
            />
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleUpload} disabled={!file || loading}>
              {loading ? "Uploading..." : "Upload & Preview"}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && previewData && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Map columns
          </h2>
          <p className="mb-2 text-sm text-foreground/60">
            Match MARG column names to the correct fields. Adjust if needed.
          </p>
          <p className="mb-6 text-xs text-foreground/40">
            {previewData.totalRows} total rows detected
          </p>
          <div className="space-y-3">
            {previewData.headers.map((header) => (
              <div key={header} className="flex items-center gap-4">
                <div className="min-w-[200px] truncate text-sm font-medium text-foreground">
                  {header}
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-foreground/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
                <select
                  value={mapping[header] || ""}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [header]: e.target.value }))
                  }
                  className="min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">— Skip —</option>
                  {FIELD_OPTIONS[migrateType!].map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={Object.values(mapping).filter(Boolean).length === 0}
            >
              Preview Data
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && previewData && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Preview data
          </h2>
          <p className="mb-6 text-sm text-foreground/60">
            Showing first {previewData.preview.length} of {previewData.totalRows}{" "}
            rows.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {Object.entries(mapping)
                    .filter(([, v]) => v)
                    .map(([header]) => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-3 py-2 text-left font-medium text-foreground/60"
                      >
                        {mapping[header]}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {previewData.preview.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Object.entries(mapping)
                      .filter(([, v]) => v)
                      .map(([header]) => (
                        <td
                          key={header}
                          className="whitespace-nowrap px-3 py-2 text-foreground"
                        >
                          {row[header] ?? ""}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button onClick={handleImport} disabled={loading}>
              {loading ? "Importing..." : "Start Import"}
            </Button>
          </div>
        </Card>
      )}

      {step === 5 && result && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Import complete
          </h2>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-primary/10 p-4 text-center">
              <p className="text-2xl font-semibold text-primary">{result.imported}</p>
              <p className="text-xs text-foreground/60">Imported</p>
            </div>
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-2xl font-semibold text-muted-foreground">
                {result.skipped}
              </p>
              <p className="text-xs text-foreground/60">Skipped</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-4 text-center">
              <p className="text-2xl font-semibold text-destructive">
                {result.errors.length}
              </p>
              <p className="text-xs text-foreground/60">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-foreground">
                Errors ({result.errors.length})
              </h3>
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-border p-4">
                {result.errors.map((err, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-foreground">
                      Row: {JSON.stringify(err.row)}
                    </span>
                    <span className="ml-2 text-destructive">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={reset}>
            Migrate More Data
          </Button>
        </Card>
      )}
    </div>
  );
}
