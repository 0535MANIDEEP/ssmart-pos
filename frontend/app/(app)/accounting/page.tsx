"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Calculator,
  Banknote,
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface TrialBalanceEntry {
  ledgerId: number;
  ledgerName: string;
  groupName: string;
  groupReportType: string;
  groupBsCategory: string | null;
  debit: number;
  credit: number;
}

interface ProfitLossData {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

const QUICK_LINKS = [
  { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/accounting/journal", label: "Journal Entries", icon: FileText },
  { href: "/accounting/trial-balance", label: "Trial Balance", icon: Calculator },
  { href: "/accounting/profit-loss", label: "Profit & Loss", icon: TrendingUp },
  { href: "/accounting/balance-sheet", label: "Balance Sheet", icon: Scale },
  { href: "/accounting/cash-flow", label: "Cash Flow", icon: Banknote },
  { href: "/accounting/receivables", label: "Receivables", icon: CircleDollarSign },
  { href: "/accounting/payables", label: "Payables", icon: CreditCard },
  { href: "/accounting/expenses", label: "Expenses", icon: Receipt },
  { href: "/accounting/payments", label: "Journal Vouchers", icon: Wallet },
  { href: "/accounting/bank-reconciliation", label: "Bank Reconciliation", icon: Landmark },
  { href: "/accounting/cost-centers", label: "Cost Centers", icon: Building2 },
  { href: "/accounting/financial-years", label: "Financial Years", icon: FileText },
];

export default function AccountingDashboardPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [trialBalance, setTrialBalance] = useState<TrialBalanceEntry[]>([]);
  const [pl, setPl] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [tb, pnl] = await Promise.all([
          api.get<TrialBalanceEntry[]>("/accounting/trial-balance"),
          api.get<ProfitLossData>("/accounting/profit-loss"),
        ]);
        setTrialBalance(tb);
        setPl(pnl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalDebit = trialBalance.reduce((s, r) => s + r.debit, 0);
  const totalCredit = trialBalance.reduce((s, r) => s + r.credit, 0);

  const totalAssets = trialBalance
    .filter((r) => r.groupBsCategory === "asset")
    .reduce((s, r) => s + r.debit - r.credit, 0);

  const totalLiabilities = trialBalance
    .filter((r) => r.groupBsCategory === "liability" || r.groupBsCategory === "capital")
    .reduce((s, r) => s + r.credit - r.debit, 0);

  const noData = !loading && trialBalance.length === 0 && !error;

  async function seedAccounts() {
    setSeeding(true);
    try {
      await api.post("/accounting/seed");
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Seed failed";
      setError(msg);
      setSeeding(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Calculator}
        title="Accounting"
        subtitle="Financial overview of your business"
      />

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-text-tertiary">Loading accounting data…</p>
        </div>
      ) : noData ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Calculator className="h-10 w-10 text-text-tertiary" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-medium text-foreground">No chart of accounts found</p>
            <p className="text-[12px] text-text-secondary">Seed the default chart of accounts to get started.</p>
          </div>
          <Button onClick={seedAccounts} disabled={seeding}>
            {seeding ? "Seeding…" : "Seed Chart of Accounts"}
          </Button>
        </Card>
      ) : (
        <>
          {error && (
            <div className="rounded border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={TrendingUp} label="Total Assets" value={money(totalAssets)} />
            <StatCard icon={TrendingDown} label="Total Liabilities" value={money(totalLiabilities)} />
            <StatCard icon={CircleDollarSign} label="Total Income" value={money(pl?.totalIncome ?? 0)} />
            <StatCard icon={Receipt} label="Total Expenses" value={money(pl?.totalExpense ?? 0)} />
            <StatCard
              icon={Calculator}
              label="Net Profit"
              value={money(pl?.netProfit ?? 0)}
              accent={(pl?.netProfit ?? 0) >= 0 ? "success" : "danger"}
            />
            <StatCard icon={Scale} label="Trial Balance" value={`${totalDebit === totalCredit ? "Balanced" : "Mismatch"}`} accent={totalDebit === totalCredit ? "success" : "danger"} />
          </div>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Quick Links</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded border border-border p-4 text-[13px] font-medium text-foreground transition-all duration-150 hover:border-brand/30 hover:bg-brand/5"
                >
                  <link.icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span className="truncate">{link.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: "success" | "danger";
}) {
  return (
    <Card variant="elevated" hoverable className="flex items-center gap-4 p-5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          accent === "success"
            ? "bg-success/10 text-success"
            : accent === "danger"
              ? "bg-danger/10 text-danger"
              : "bg-brand/10 text-brand"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[12px] font-medium text-text-secondary">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </Card>
  );
}
