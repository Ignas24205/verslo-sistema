"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Receipt, CalendarClock, RefreshCw, LayoutGrid } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ExpenseModal, { type Expense, CATEGORIES } from "./ExpenseModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Build last N months as filter options: value = "YYYY-MM", label = "Jan 2025"
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildMonthOptions(n = 13): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
    return { value, label };
  });
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function expenseMonthValue(date: string) {
  return date.slice(0, 7); // "YYYY-MM"
}

// Category colour dots
const CAT_COLOR: Record<string, string> = {
  Phone:     "bg-blue-400",
  Fuel:      "bg-orange-400",
  Software:  "bg-purple-400",
  Domain:    "bg-cyan-400",
  Office:    "bg-yellow-400",
  Marketing: "bg-pink-400",
  Other:     "bg-zinc-400",
};

function CatDot({ cat }: { cat: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${CAT_COLOR[cat] ?? "bg-zinc-400"}`}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Expense | undefined>(undefined);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthValue());
  const [filterCat,   setFilterCat]   = useState<string>("All");

  const monthOptions = useMemo(() => buildMonthOptions(13), []);

  // ── Data ──────────────────────────────────────────────────────────────────

  async function fetchExpenses() {
    const supabase = createClient();
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });
    setExpenses((data as Expense[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchExpenses();
    const supabase = createClient();
    const ch = supabase
      .channel("expenses-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, fetchExpenses)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = currentMonthValue();
    const thisYear  = now.getFullYear().toString();

    const monthTotal = expenses
      .filter(e => expenseMonthValue(e.date) === thisMonth)
      .reduce((s, e) => s + e.amount, 0);

    const yearTotal = expenses
      .filter(e => e.date.startsWith(thisYear))
      .reduce((s, e) => s + e.amount, 0);

    const recurringMonth = expenses
      .filter(e => e.recurring)
      .reduce((s, e) => s + e.amount, 0);

    // Category breakdown for the selected period
    const scopedExpenses = filterMonth === "all"
      ? expenses
      : expenses.filter(e => expenseMonthValue(e.date) === filterMonth);

    const byCategory: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const total = scopedExpenses
        .filter(e => e.category === cat)
        .reduce((s, e) => s + e.amount, 0);
      if (total > 0) byCategory[cat] = total;
    }

    return { monthTotal, yearTotal, recurringMonth, byCategory };
  }, [expenses, filterMonth]);

  // ── Filtered table rows ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const monthMatch = filterMonth === "all" || expenseMonthValue(e.date) === filterMonth;
      const catMatch   = filterCat === "All" || e.category === filterCat;
      return monthMatch && catMatch;
    });
  }, [expenses, filterMonth, filterCat]);

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", deleteId);
    setDeleteId(null);
    setDeleting(false);
    fetchExpenses();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Expenses</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Business expenses by category</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={CalendarClock}
          label="This month"
          value={fmt(kpis.monthTotal)}
          sub={`${MONTH_ABBR[new Date().getMonth()]} ${new Date().getFullYear()}`}
          color="text-blue-500"
        />
        <KpiCard
          icon={Receipt}
          label="This year"
          value={fmt(kpis.yearTotal)}
          sub={new Date().getFullYear().toString()}
          color="text-zinc-500"
        />
        <KpiCard
          icon={RefreshCw}
          label="Recurring / mo"
          value={fmt(kpis.recurringMonth)}
          sub="Fixed monthly costs"
          color="text-purple-500"
        />
      </div>

      {/* Category breakdown */}
      {Object.keys(kpis.byCategory).length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-zinc-500">
            <LayoutGrid size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              By category
              {filterMonth !== "all" && (
                <span className="ml-1 font-normal text-zinc-400">
                  — {monthOptions.find(m => m.value === filterMonth)?.label}
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.entries(kpis.byCategory) as [string, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([cat, total]) => {
                const maxVal = Math.max(...Object.values(kpis.byCategory));
                const pct = (total / maxVal) * 100;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                        <CatDot cat={cat} />
                        {cat}
                      </span>
                      <span className="text-xs text-zinc-500">{fmt(total)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${CAT_COLOR[cat] ?? "bg-zinc-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Month filter */}
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        >
          <option value="all">All time</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterCat === cat
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {cat !== "All" && <CatDot cat={cat} />}
              {cat}
            </button>
          ))}
        </div>

        {/* Row count + total */}
        {!loading && (
          <span className="ml-auto text-sm text-zinc-400">
            {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
            {" · "}
            <span className="font-medium text-zinc-700">{fmt(filteredTotal)}</span>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="bg-zinc-50">
                {["Date", "Category", "Description", "Amount", "Recurring", ""].map((col) => (
                  <th
                    key={col}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
                      col === "Amount" ? "text-right" : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    {expenses.length === 0
                      ? "No expenses yet. Click \"Add Expense\" to get started."
                      : "No expenses match the current filters."}
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {fmtDate(e.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-zinc-800">
                      <CatDot cat={e.category} />
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">
                    {e.description ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {fmt(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {e.recurring ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                        <RefreshCw size={10} />
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(e)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(e.id)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <ExpenseModal
          expense={editing}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
          onSaved={fetchExpenses}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete expense?</h3>
            <p className="mt-1 text-sm text-zinc-500">This action cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon size={15} />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}
