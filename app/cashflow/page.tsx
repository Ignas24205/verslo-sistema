"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  CalendarClock,
  FileText,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Receipt,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type CashflowRow = {
  id: string;
  name: string;
  customer_name: string | null;
  fin_status: string;
  invoice_date: string | null;
  revenue: number;
  paid_amount: number;
};

type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  recurring: boolean;
};

type Filter = "All" | "Awaiting" | "Overdue" | "Paid";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function paymentStatus(fin_status: string): "Paid" | "Awaiting" | "Overdue" {
  if (fin_status === "Paid") return "Paid";
  if (fin_status === "Overdue") return "Overdue";
  return "Awaiting";
}

const statusStyle: Record<string, string> = {
  Paid: "bg-green-50 text-green-700 ring-green-200",
  Awaiting: "bg-blue-50 text-blue-700 ring-blue-200",
  Overdue: "bg-red-50 text-red-700 ring-red-200",
};

function matchesFilter(row: CashflowRow, filter: Filter): boolean {
  if (filter === "All") return true;
  return paymentStatus(row.fin_status) === filter;
}

// ─── Forecast chart ───────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getNext6Months(): { label: string; year: number; month: number }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() };
  });
}

function ForecastChart({ rows }: { rows: CashflowRow[] }) {
  const months = getNext6Months();

  const bars = months.map(({ label, year, month }) => {
    const planned = rows
      .filter((r) => {
        if (!r.invoice_date || r.fin_status === "Paid") return false;
        const d = new Date(r.invoice_date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, r) => s + r.revenue, 0);

    const received = rows
      .filter((r) => {
        if (!r.invoice_date || r.fin_status !== "Paid") return false;
        const d = new Date(r.invoice_date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, r) => s + r.paid_amount, 0);

    return { label, planned, received };
  });

  const maxVal = Math.max(...bars.map((b) => b.planned + b.received), 1);

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Cashflow Forecast — next 6 months
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-end gap-4 h-48">
          {bars.map((bar) => {
            const receivedPct = (bar.received / maxVal) * 100;
            const plannedPct = (bar.planned / maxVal) * 100;
            const total = bar.planned + bar.received;
            return (
              <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                {/* Tooltip-like value */}
                <span className="text-xs text-zinc-500 whitespace-nowrap">
                  {total > 0 ? fmt(total) : "—"}
                </span>
                {/* Bar */}
                <div className="relative flex w-full flex-col-reverse rounded overflow-hidden bg-zinc-100" style={{ height: "9rem" }}>
                  {/* Received (bottom, green) */}
                  {bar.received > 0 && (
                    <div
                      className="w-full bg-green-400 transition-all duration-500"
                      style={{ height: `${receivedPct}%` }}
                    />
                  )}
                  {/* Planned (top, blue) */}
                  {bar.planned > 0 && (
                    <div
                      className="w-full bg-blue-400 transition-all duration-500"
                      style={{ height: `${plannedPct}%` }}
                    />
                  )}
                </div>
                {/* Label */}
                <span className="text-xs text-zinc-500 whitespace-nowrap">{bar.label}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />
            Expected (planned)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-green-400" />
            Received
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashflowPage() {
  const [rows, setRows] = useState<CashflowRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("All");

  async function fetchData() {
    const supabase = createClient();
    const [{ data: proj }, { data: exp }] = await Promise.all([
      supabase
        .from("v_projects_rollup")
        .select("id, name, customer_name, fin_status, invoice_date, revenue, paid_amount")
        .order("invoice_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("expenses")
        .select("id, date, category, description, amount, recurring")
        .order("amount", { ascending: false }),
    ]);

    setRows((proj as CashflowRow[]) ?? []);
    setExpenses((exp as ExpenseRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("cashflow-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── KPI calculations ─────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const planned = rows
      .filter((r) => r.invoice_date && r.fin_status !== "Paid")
      .reduce((s, r) => s + r.revenue, 0);

    const invoiced = rows
      .filter((r) => r.fin_status === "Invoiced" || r.fin_status === "Overdue")
      .reduce((s, r) => s + r.revenue, 0);

    const received = rows
      .filter((r) => r.fin_status === "Paid")
      .reduce((s, r) => s + r.paid_amount, 0);

    const outstanding = rows
      .filter((r) => r.fin_status === "Invoiced" || r.fin_status === "Overdue")
      .reduce((s, r) => s + (r.revenue - r.paid_amount), 0);

    const overdue = rows
      .filter((r) => r.fin_status === "Overdue")
      .reduce((s, r) => s + r.revenue, 0);

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const expensesThisMonth = expenses
      .filter((e) => e.date.slice(0, 7) === thisMonthKey)
      .reduce((s, e) => s + e.amount, 0);

    return { planned, invoiced, received, outstanding, overdue, expensesThisMonth };
  }, [rows, expenses]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesFilter(r, filter)),
    [rows, filter]
  );

  const FILTERS: Filter[] = ["All", "Awaiting", "Overdue", "Paid"];

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Cashflow</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Cash flow and payment forecast</p>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          icon={CalendarClock}
          label="Planned Revenue"
          value={fmt(kpis.planned)}
          sub="Planned by invoice date"
          color="text-zinc-500"
        />
        <KpiCard
          icon={FileText}
          label="Invoiced"
          value={fmt(kpis.invoiced)}
          sub="Invoice issued"
          color="text-blue-500"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Received"
          value={fmt(kpis.received)}
          sub="Payments received"
          color="text-green-500"
        />
        <KpiCard
          icon={Clock3}
          label="Outstanding"
          value={fmt(kpis.outstanding)}
          sub="Awaiting payment"
          color="text-yellow-500"
        />
        <KpiCard
          icon={AlertCircle}
          label="Overdue"
          value={fmt(kpis.overdue)}
          sub="Payment overdue"
          color={kpis.overdue > 0 ? "text-red-500" : "text-zinc-500"}
          alert={kpis.overdue > 0}
        />
        <KpiCard
          icon={Receipt}
          label="Expenses"
          value={fmt(kpis.expensesThisMonth)}
          sub="Business expenses this month"
          color="text-orange-500"
        />
      </div>

      {/* Forecast chart */}
      <ForecastChart rows={rows} />

      {/* Filter tabs */}
      <div className="mt-8 flex items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            }`}
          >
            {f}
            {f !== "All" && (
              <span className="ml-1.5 text-xs opacity-70">
                {rows.filter((r) => matchesFilter(r, f)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Projects table */}
      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="bg-zinc-50">
                {[
                  "Project",
                  "Client",
                  "Planned Invoice",
                  "Revenue",
                  "Paid",
                  "Outstanding",
                  "Status",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    {filter === "All" ? "No projects found." : `No "${filter}" projects.`}
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const outstanding = Math.max(0, row.revenue - row.paid_amount);
                const status = paymentStatus(row.fin_status);
                const isOverdue = status === "Overdue";
                return (
                  <tr key={row.id} className={`hover:bg-zinc-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{row.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{row.customer_name ?? "—"}</td>
                    <td className={`px-4 py-3 ${isOverdue ? "text-red-600 font-medium" : "text-zinc-600"}`}>
                      {fmtDate(row.invoice_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{fmt(row.revenue)}</td>
                    <td className="px-4 py-3 text-green-700">
                      {row.paid_amount > 0 ? fmt(row.paid_amount) : "—"}
                    </td>
                    <td className={`px-4 py-3 font-medium ${outstanding > 0 ? (isOverdue ? "text-red-600" : "text-zinc-900") : "text-zinc-400"}`}>
                      {outstanding > 0 ? fmt(outstanding) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle[status]}`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Recurring expenses */}
      {expenses.filter(e => e.recurring).length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Recurring expenses
            </h2>
            <span className="text-xs text-zinc-400">
              Monthly fixed costs ·{" "}
              <span className="font-medium text-zinc-700">
                {fmt(expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0))}
                /mo
              </span>
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead>
                <tr className="bg-zinc-50">
                  {["Category", "Description", "Amount / mo"].map((col) => (
                    <th
                      key={col}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
                        col === "Amount / mo" ? "text-right" : "text-left"
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {expenses
                  .filter(e => e.recurring)
                  .map(e => (
                    <tr key={e.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800">
                          <RefreshCw size={12} className="text-purple-500" />
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {e.description ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {fmt(e.amount)}
                      </td>
                    </tr>
                  ))}
                {/* Total row */}
                <tr className="bg-zinc-50">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Total monthly
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                    {fmt(expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-white p-5 ${alert ? "border-red-200" : "border-zinc-200"}`}>
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon size={16} />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${alert ? "text-red-600" : "text-zinc-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}
