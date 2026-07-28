"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Plus, X, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface AccountGroup {
  id: number;
  code: string;
  name: string;
  nature: string;
  reportType: string;
  parentId: number | null;
  isSystem: boolean;
  children: AccountGroup[];
}

interface Ledger {
  id: number;
  name: string;
  groupId: number;
  openingDebit: number;
  openingCredit: number;
  isSystem: boolean;
  group: { id: number; name: string; code: string };
}

export default function ChartOfAccountsPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ code: "", name: "", nature: "debit", reportType: "balance_sheet", parentId: "" });
  const [ledgerForm, setLedgerForm] = useState({ name: "", groupId: "", openingDebit: "0", openingCredit: "0" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [g, l] = await Promise.all([
        api.get<AccountGroup[]>("/accounting/groups"),
        api.get<Ledger[]>("/accounting/ledgers"),
      ]);
      setGroups(g);
      setLedgers(l);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/accounting/groups", {
        code: groupForm.code,
        name: groupForm.name,
        nature: groupForm.nature,
        reportType: groupForm.reportType,
        parentId: groupForm.parentId ? Number(groupForm.parentId) : null,
      });
      setShowGroupForm(false);
      setGroupForm({ code: "", name: "", nature: "debit", reportType: "balance_sheet", parentId: "" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  }

  async function createLedger(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/accounting/ledgers", {
        name: ledgerForm.name,
        groupId: Number(ledgerForm.groupId),
        openingDebit: Number(ledgerForm.openingDebit) || 0,
        openingCredit: Number(ledgerForm.openingCredit) || 0,
      });
      setShowLedgerForm(false);
      setLedgerForm({ name: "", groupId: "", openingDebit: "0", openingCredit: "0" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ledger");
    } finally {
      setSubmitting(false);
    }
  }

  function allGroupIds(groups: AccountGroup[]): number[] {
    const ids: number[] = [];
    for (const g of groups) {
      ids.push(g.id);
      ids.push(...allGroupIds(g.children));
    }
    return ids;
  }

  const flatGroupOptions = flattenGroups(groups);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BookOpen}
        title="Chart of Accounts"
        subtitle="Account groups and ledgers."
        action={
          <>
            <Button onClick={() => { setShowGroupForm((s) => !s); setShowLedgerForm(false); }}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Group
            </Button>
            <Button onClick={() => { setShowLedgerForm((s) => !s); setShowGroupForm(false); }}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Ledger
            </Button>
          </>
        }
      />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {showGroupForm && (
        <Card variant="elevated" className="p-6">
          <form onSubmit={createGroup} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Code" value={groupForm.code} onChange={(e) => setGroupForm((f) => ({ ...f, code: e.target.value }))} required />
            <Field label="Name" value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Nature</label>
              <select
                value={groupForm.nature}
                onChange={(e) => setGroupForm((f) => ({ ...f, nature: e.target.value }))}
                className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Report Type</label>
              <select
                value={groupForm.reportType}
                onChange={(e) => setGroupForm((f) => ({ ...f, reportType: e.target.value }))}
                className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
              >
                <option value="balance_sheet">Balance Sheet</option>
                <option value="profit_loss">Profit & Loss</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Parent Group</label>
              <select
                value={groupForm.parentId}
                onChange={(e) => setGroupForm((f) => ({ ...f, parentId: e.target.value }))}
                className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
              >
                <option value="">None (Root)</option>
                {flatGroupOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Group"}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowGroupForm(false)}>
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {showLedgerForm && (
        <Card variant="elevated" className="p-6">
          <form onSubmit={createLedger} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" value={ledgerForm.name} onChange={(e) => setLedgerForm((f) => ({ ...f, name: e.target.value }))} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Group</label>
              <select
                value={ledgerForm.groupId}
                onChange={(e) => setLedgerForm((f) => ({ ...f, groupId: e.target.value }))}
                className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                required
              >
                <option value="">Select group…</option>
                {flatGroupOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </div>
            <Field label="Opening Debit" type="number" value={ledgerForm.openingDebit} onChange={(e) => setLedgerForm((f) => ({ ...f, openingDebit: e.target.value }))} />
            <Field label="Opening Credit" type="number" value={ledgerForm.openingCredit} onChange={(e) => setLedgerForm((f) => ({ ...f, openingCredit: e.target.value }))} />
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Ledger"}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowLedgerForm(false)}>
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center text-sm text-foreground/50">
          <BookOpen className="h-8 w-8 text-foreground/30" />
          <span>No account groups found.</span>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-col gap-1">
            {groups.map((group) => (
              <GroupNode key={group.id} group={group} ledgers={ledgers} money={money} depth={0} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function flattenGroups(groups: AccountGroup[]): { id: number; code: string; name: string }[] {
  const result: { id: number; code: string; name: string }[] = [];
  for (const g of groups) {
    result.push({ id: g.id, code: g.code, name: g.name });
    result.push(...flattenGroups(g.children));
  }
  return result;
}

function GroupNode({
  group,
  ledgers,
  money,
  depth,
}: {
  group: AccountGroup;
  ledgers: Ledger[];
  money: (n: number) => string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const groupLedgers = ledgers.filter((l) => l.groupId === group.id);
  const hasChildren = group.children.length > 0 || groupLedgers.length > 0;

  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <div
        className={`flex items-center gap-2 rounded px-3 py-2 transition-colors hover:bg-surface-muted/40 ${hasChildren ? "cursor-pointer" : ""}`}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-foreground/40" aria-hidden="true" />
          )
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <span className="text-[12px] font-mono font-semibold text-brand/70 w-16 bg-brand/5 rounded px-2 py-0.5">{group.code}</span>
        <span className="text-[13px] font-medium text-foreground">{group.name}</span>
        <span className="ml-auto rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary capitalize">{group.nature}</span>
      </div>
      {expanded && (
        <div className="flex flex-col gap-0.5">
          {group.children.map((child) => (
            <GroupNode key={child.id} group={child} ledgers={ledgers} money={money} depth={depth + 1} />
          ))}
          {groupLedgers.map((ledger) => (
            <div
              key={ledger.id}
              className="flex items-center gap-2 rounded px-3 py-2 ml-8 transition-colors hover:bg-surface-muted/40"
            >
              <span className="text-[13px] text-foreground/70">{ledger.name}</span>
              {(ledger.openingDebit !== 0 || ledger.openingCredit !== 0) && (
                <span className="ml-auto text-[12px] text-text-secondary">
                  {ledger.openingDebit > 0 ? money(ledger.openingDebit) + " Dr" : money(ledger.openingCredit) + " Cr"}
                </span>
              )}
              {ledger.isSystem && (
                <span className="text-[11px] text-text-tertiary">(system)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
