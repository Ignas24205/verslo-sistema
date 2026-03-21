"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  DollarSign,
  TrendingUp,
  Percent,
  Megaphone,
  Package,
  Clock,
  Receipt,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectRow = {
  id: string;
  name: string;
  customer_name: string | null;
  fin_status: string;
  op_status: string;
  invoice_date: string | null;
  revenue: number;
  profit: number;
  paid_amount: number;
  created_at: string;
};

type MarketingRow = {
  year: number;
  month: number; // 1-indexed
  meta_budget: number;
  google_budget: number;
  tiktok_budget: number;
};

type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  recurring: boolean;
};

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

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Returns last N months as {year, month0, label} — month0 is JS 0-indexed */
function getLastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      year: d.getFullYear(),
      month0: d.getMonth(),
      label: `${MONTH_ABBR[d.getMonth()]} '${d.getFullYear().toString().slice(2)}`,
    };
  });
}

/** Key for grouping projects by invoice month */
function invoiceKey(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}:${d.getMonth()}`;
}

// ─── Status badges ─────────────────────────────────────────────────────────

const OP_STYLE: Record<string, string> = {
  "In progress": "bg-yellow-50 text-yellow-700 ring-yellow-200",
  Finished:      "bg-green-50  text-green-700  ring-green-200",
};
const FIN_STYLE: Record<string, string> = {
  "Not invoiced": "bg-zinc-100  text-zinc-600  ring-zinc-200",
  Invoiced:       "bg-blue-50   text-blue-700   ring-blue-200",
  Paid:           "bg-green-50  text-green-700  ring-green-200",
  Overdue:        "bg-red-50    text-red-700    ring-red-200",
};
function Badge({ label, map }: { label: string; map: Record<string, string> }) {
  const cls = map[label] ?? "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

// ─── Chart: vertical bar ──────────────────────────────────────────────────

function BarChart({
  data,
  barColor = "bg-blue-400",
  showValues = true,
}: {
  data: { label: string; value: number }[];
  barColor?: string;
  showValues?: boolean;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1 min-w-0">
          {showValues && (
            <span className="text-[10px] text-zinc-400 truncate w-full text-center">
              {value > 0 ? fmt(value) : ""}
            </span>
          )}
          <div className="relative w-full rounded-sm overflow-hidden bg-zinc-100" style={{ height: "6.5rem" }}>
            <div
              className={`absolute bottom-0 w-full ${barColor} rounded-sm transition-all duration-700`}
              style={{ height: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-400 truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart: SVG line ─────────────────────────────────────────────────────

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 500;
  const H = 140;
  const PL = 4; const PR = 4; const PT = 18; const PB = 22;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const allVals = data.map(d => d.value);
  const rawMax = Math.max(...allVals, 0);
  const rawMin = Math.min(...allVals, 0);
  const span = rawMax - rawMin || 1;
  const vMax = rawMax + span * 0.1;
  const vMin = rawMin - span * 0.1;
  const vSpan = vMax - vMin;

  function px(i: number) { return PL + (i / (data.length - 1 || 1)) * innerW; }
  function py(v: number) { return PT + ((vMax - v) / vSpan) * innerH; }

  const polyline = data.map((d, i) => `${px(i)},${py(d.value)}`).join(" ");
  const zeroY = py(0);

  // Area fill path
  const area = [
    `M ${px(0)},${zeroY}`,
    ...data.map((d, i) => `L ${px(i)},${py(d.value)}`),
    `L ${px(data.length - 1)},${zeroY}`,
    "Z",
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "10rem" }}>
      {/* Zero line */}
      <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY}
        stroke="#e4e4e7" strokeWidth={1} strokeDasharray="4 3" />

      {/* Area */}
      <path d={area} fill="#22c55e" fillOpacity={0.08} />

      {/* Line */}
      <polyline fill="none" stroke="#22c55e" strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" points={polyline} />

      {/* Dots + x-labels */}
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={px(i)} cy={py(d.value)} r={3.5} fill="#22c55e" />
          <text x={px(i)} y={H - 4} textAnchor="middle" fill="#a1a1aa" fontSize={9}>
            {d.label}
          </text>
          {/* value label */}
          {d.value !== 0 && (
            <text x={px(i)} y={py(d.value) - 7} textAnchor="middle" fill="#71717a" fontSize={8.5}>
              {fmt(d.value)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Chart: grouped bars (spend / expenses / revenue) ─────────────────────

function GroupedBarChart({
  data,
}: {
  data: { label: string; spend: number; expenses: number; revenue: number }[];
}) {
  const max = Math.max(...data.flatMap(d => [d.spend, d.expenses, d.revenue]), 1);

  return (
    <div className="flex h-40 items-end gap-2">
      {data.map(({ label, spend, expenses, revenue }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1 min-w-0">
          <div className="flex w-full items-end gap-0.5" style={{ height: "6.5rem" }}>
            {/* Marketing spend bar */}
            <div className="relative flex-1 rounded-sm overflow-hidden bg-zinc-100 h-full">
              <div
                className="absolute bottom-0 w-full bg-zinc-400 rounded-sm transition-all duration-700"
                style={{ height: `${(spend / max) * 100}%` }}
              />
            </div>
            {/* Expenses bar */}
            <div className="relative flex-1 rounded-sm overflow-hidden bg-zinc-100 h-full">
              <div
                className="absolute bottom-0 w-full bg-orange-400 rounded-sm transition-all duration-700"
                style={{ height: `${(expenses / max) * 100}%` }}
              />
            </div>
            {/* Revenue bar */}
            <div className="relative flex-1 rounded-sm overflow-hidden bg-zinc-100 h-full">
              <div
                className="absolute bottom-0 w-full bg-blue-400 rounded-sm transition-all duration-700"
                style={{ height: `${(revenue / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart wrapper card ───────────────────────────────────────────────────

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      <p className="mt-0.5 mb-5 text-xs text-zinc-400">{sub}</p>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects]       = useState<ProjectRow[]>([]);
  const [marketing, setMarketing]     = useState<MarketingRow[]>([]);
  const [expenses, setExpenses]       = useState<ExpenseRow[]>([]);
  const [warehouseValue, setWarehouse] = useState(0);
  const [loading, setLoading]         = useState(true);

  // Stable month range — recomputed only on mount
  const months6 = useMemo(() => getLastMonths(6), []);

  async function fetchAll() {
    const supabase = createClient();
    const [{ data: proj }, { data: mkt }, { data: wh }, { data: exp }] = await Promise.all([
      supabase
        .from("v_projects_rollup")
        .select(
          "id, name, customer_name, fin_status, op_status, invoice_date, revenue, profit, paid_amount, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("marketing_monthly")
        .select("year, month, meta_budget, google_budget, tiktok_budget"),
      supabase
        .from("products")
        .select("stock, supplier_price")
        .eq("active", true),
      supabase
        .from("expenses")
        .select("id, date, category, description, amount, recurring")
        .order("date", { ascending: false }),
    ]);

    setProjects((proj as ProjectRow[]) ?? []);
    setMarketing((mkt as MarketingRow[]) ?? []);
    setExpenses((exp as ExpenseRow[]) ?? []);
    const wv = ((wh ?? []) as { stock: number; supplier_price: number }[])
      .reduce((s, p) => s + p.stock * p.supplier_price, 0);
    setWarehouse(wv);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    const supabase = createClient();
    const ch = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_monthly" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── KPIs ────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const invoiced = projects.filter(p => p.fin_status !== "Not invoiced");
    const revenue  = invoiced.reduce((s, p) => s + p.revenue, 0);
    const profit   = invoiced.reduce((s, p) => s + p.profit, 0);
    const margin   = revenue > 0 ? (profit / revenue) * 100 : 0;
    const backlog  = projects
      .filter(p => p.fin_status === "Not invoiced")
      .reduce((s, p) => s + p.revenue, 0);
    const mktSpend = marketing.reduce(
      (s, m) => s + m.meta_budget + m.google_budget + m.tiktok_budget, 0
    );
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const expensesThisMonth = expenses
      .filter(e => e.date.slice(0, 7) === thisMonthKey)
      .reduce((s, e) => s + e.amount, 0);
    return { revenue, profit, margin, backlog, mktSpend, expensesThisMonth };
  }, [projects, marketing, expenses]);

  // ── Revenue by month (invoiced/paid/overdue) ─────────────────────────────

  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of projects) {
      const k = invoiceKey(p.invoice_date);
      if (!k || p.fin_status === "Not invoiced") continue;
      map[k] = (map[k] ?? 0) + p.revenue;
    }
    return months6.map(m => ({
      label: m.label,
      value: map[`${m.year}:${m.month0}`] ?? 0,
    }));
  }, [projects, months6]);

  // ── Profit by month ───────────────────────────────────────────────────────

  const profitByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of projects) {
      const k = invoiceKey(p.invoice_date);
      if (!k || p.fin_status === "Not invoiced") continue;
      map[k] = (map[k] ?? 0) + p.profit;
    }
    return months6.map(m => ({
      label: m.label,
      value: map[`${m.year}:${m.month0}`] ?? 0,
    }));
  }, [projects, months6]);

  // ── Marketing spend vs Revenue by month ──────────────────────────────────

  const mktVsRevenue = useMemo(() => {
    const revMap: Record<string, number> = {};
    for (const p of projects) {
      const k = invoiceKey(p.invoice_date);
      if (!k || p.fin_status === "Not invoiced") continue;
      revMap[k] = (revMap[k] ?? 0) + p.revenue;
    }
    const spendMap: Record<string, number> = {};
    for (const m of marketing) {
      const k = `${m.year}:${m.month - 1}`; // marketing.month is 1-indexed → convert to 0-indexed
      spendMap[k] = (spendMap[k] ?? 0) + m.meta_budget + m.google_budget + m.tiktok_budget;
    }
    const expMap: Record<string, number> = {};
    for (const e of expenses) {
      const d = new Date(e.date + "T00:00:00");
      const k = `${d.getFullYear()}:${d.getMonth()}`;
      expMap[k] = (expMap[k] ?? 0) + e.amount;
    }
    return months6.map(m => ({
      label:    m.label,
      spend:    spendMap[`${m.year}:${m.month0}`] ?? 0,
      expenses: expMap[`${m.year}:${m.month0}`]   ?? 0,
      revenue:  revMap[`${m.year}:${m.month0}`]   ?? 0,
    }));
  }, [projects, marketing, expenses, months6]);

  const recentProjects = projects.slice(0, 5);
  const recentExpenses = expenses.slice(0, 5);

  // ── KPI card definitions ─────────────────────────────────────────────────

  const cards = [
    {
      label: "Revenue",
      value: fmt(kpis.revenue),
      sub: "Invoiced projects",
      Icon: DollarSign,
      iconCls: "text-blue-500",
      valCls: "text-zinc-900",
      borderCls: "border-zinc-200",
    },
    {
      label: "Profit",
      value: fmt(kpis.profit),
      sub: "Profit (invoiced projects)",
      Icon: TrendingUp,
      iconCls: kpis.profit >= 0 ? "text-green-500" : "text-red-500",
      valCls: kpis.profit >= 0 ? "text-zinc-900" : "text-red-600",
      borderCls: kpis.profit < 0 ? "border-red-200" : "border-zinc-200",
    },
    {
      label: "Margin %",
      value: `${kpis.margin.toFixed(1)}%`,
      sub: "Average margin",
      Icon: Percent,
      iconCls: kpis.margin >= 20 ? "text-green-500" : kpis.margin >= 0 ? "text-yellow-500" : "text-red-500",
      valCls: "text-zinc-900",
      borderCls: "border-zinc-200",
    },
    {
      label: "Mkt Spend",
      value: fmt(kpis.mktSpend),
      sub: "Total marketing spend",
      Icon: Megaphone,
      iconCls: "text-purple-500",
      valCls: "text-zinc-900",
      borderCls: "border-zinc-200",
    },
    {
      label: "Warehouse",
      value: fmt(warehouseValue),
      sub: "Warehouse value (qty × price)",
      Icon: Package,
      iconCls: "text-orange-500",
      valCls: "text-zinc-900",
      borderCls: "border-zinc-200",
    },
    {
      label: "Backlog",
      value: fmt(kpis.backlog),
      sub: "Not yet invoiced",
      Icon: Clock,
      iconCls: "text-zinc-400",
      valCls: "text-zinc-900",
      borderCls: "border-zinc-200",
    },
    {
      label: "Expenses",
      value: fmt(kpis.expensesThisMonth),
      sub: "Business expenses this month",
      Icon: Receipt,
      iconCls: "text-red-400",
      valCls: "text-zinc-900",
      borderCls: "border-zinc-200",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Business overview in real time</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-yellow-400" : "bg-green-400"}`} />
          {loading ? "Loading..." : "Live"}
        </span>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(({ label, value, sub, Icon, iconCls, valCls, borderCls }) => (
          <div key={label} className={`rounded-lg border ${borderCls} bg-white p-4`}>
            <div className={`flex items-center gap-1.5 ${iconCls}`}>
              <Icon size={13} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {label}
              </span>
            </div>
            <p className={`mt-2 text-lg font-semibold leading-tight ${valCls}`}>
              {loading ? <span className="text-zinc-200">———</span> : value}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-400 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Revenue per month"
          sub="Invoiced projects — last 6 months"
        >
          <BarChart data={revenueByMonth} barColor="bg-blue-400" />
        </ChartCard>

        <ChartCard
          title="Profit per month"
          sub="Profit by invoice date — last 6 months"
        >
          <LineChart data={profitByMonth} />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="mt-4">
        <ChartCard
          title="Marketing Spend vs Expenses vs Revenue"
          sub="Marketing (gray) · Expenses (orange) · Revenue (blue) — last 6 months"
        >
          <GroupedBarChart data={mktVsRevenue} />
          <div className="mt-4 flex items-center gap-5 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-zinc-400" />
              Marketing spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-orange-400" />
              Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-blue-400" />
              Revenue
            </span>
          </div>
        </ChartCard>
      </div>

      {/* Recent projects */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent projects
          </h2>
          <Link
            href="/sales"
            className="text-xs font-medium text-zinc-400 underline underline-offset-2 hover:text-zinc-700"
          >
            All projects →
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead>
                <tr className="bg-zinc-50">
                  {["Project", "Client", "Status", "Financials", "Revenue", "Profit", "Invoice date"].map(
                    col => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                      >
                        {col}
                      </th>
                    )
                  )}
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
                {!loading && recentProjects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No projects yet.
                    </td>
                  </tr>
                )}
                {recentProjects.map(p => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => router.push(`/sales/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{p.customer_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge label={p.op_status} map={OP_STYLE} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={p.fin_status} map={FIN_STYLE} />
                    </td>
                    <td className="px-4 py-3 text-zinc-900">{fmt(p.revenue)}</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        p.profit >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {fmt(p.profit)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{fmtDate(p.invoice_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent expenses */}
      <div className="mt-6 mb-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent expenses
          </h2>
          <Link
            href="/expenses"
            className="text-xs font-medium text-zinc-400 underline underline-offset-2 hover:text-zinc-700"
          >
            All expenses →
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">Loading...</p>
          ) : recentExpenses.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">No expenses yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentExpenses.map(e => (
                <li key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-zinc-400 shrink-0">
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 shrink-0">
                      {e.category}
                    </span>
                    <span className="truncate text-sm text-zinc-600">
                      {e.description ?? ""}
                    </span>
                  </div>
                  <span className="ml-4 shrink-0 text-sm font-medium text-zinc-900">
                    {fmt(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
