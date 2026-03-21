"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  FolderOpen,
  Users,
  Receipt,
  Megaphone,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

function firstOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "";
  return Number(n).toFixed(2);
}

function fmtMoneyDisplay(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtExportDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function downloadXlsx(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}

// ─── PDF header helper ────────────────────────────────────────────────────────

function addPdfHeader(
  doc: jsPDF,
  reportTitle: string,
  range: DateRange
) {
  const pageW = doc.internal.pageSize.getWidth();

  // Company name
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text("Sun Closets System", 14, 18);

  // Report title
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(63, 63, 70);
  doc.text(reportTitle, 14, 27);

  // Meta line
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text(
    `Exported: ${fmtExportDate()}   ·   Period: ${range.from} – ${range.to}`,
    14,
    34
  );

  // Divider
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.3);
  doc.line(14, 38, pageW - 14, 38);

  // Page number (right side)
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text(`Page 1`, pageW - 14, 18, { align: "right" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = { from: string; to: string };

// ─── Excel exports ────────────────────────────────────────────────────────────

async function exportProjectsXlsx(range: DateRange) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_projects_rollup")
    .select(
      "name, customer_name, lead_source, op_status, fin_status, start_date, end_date, invoice_date, work_revenue, material_revenue, material_cost, extra_costs, revenue, profit, paid_amount, created_at"
    )
    .gte("created_at", range.from + "T00:00:00")
    .lte("created_at", range.to + "T23:59:59")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    "Project name":         r.name,
    "Customer":             r.customer_name ?? "",
    "Lead source":          r.lead_source ?? "",
    "Op status":            r.op_status ?? "",
    "Financial status":     r.fin_status ?? "",
    "Start date":           r.start_date ?? "",
    "End date":             r.end_date ?? "",
    "Invoice date":         r.invoice_date ?? "",
    "Work revenue ($)":     fmtMoney(r.work_revenue),
    "Material revenue ($)": fmtMoney(r.material_revenue),
    "Material cost ($)":    fmtMoney(r.material_cost),
    "Extra costs ($)":      fmtMoney(r.extra_costs),
    "Total revenue ($)":    fmtMoney(r.revenue),
    "Profit ($)":           fmtMoney(r.profit),
    "Paid ($)":             fmtMoney(r.paid_amount),
    "Created at":           r.created_at ? r.created_at.slice(0, 10) : "",
  }));

  downloadXlsx(rows, `projects_${range.from}_${range.to}.xlsx`);
}

async function exportCustomersXlsx(range: DateRange) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "name, client_type, company_name, company_code, first_name, last_name, phone, email, address_street, address_city, address_state, address_zip, sales_tax_exempt, customer_type, notes, created_at"
    )
    .gte("created_at", range.from + "T00:00:00")
    .lte("created_at", range.to + "T23:59:59")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    "Name":         r.name,
    "Client type":  r.client_type ?? "Individual",
    "Company name": r.company_name ?? "",
    "Company code": r.company_code ?? "",
    "First name":   r.first_name ?? "",
    "Last name":    r.last_name ?? "",
    "Phone":        r.phone ?? "",
    "Email":        r.email ?? "",
    "Street":       r.address_street ?? "",
    "City":         r.address_city ?? "",
    "State":        r.address_state ?? "",
    "ZIP":          r.address_zip ?? "",
    "Tax exempt":   r.sales_tax_exempt ? "Yes" : "No",
    "Tags":         r.customer_type ?? "",
    "Notes":        r.notes ?? "",
    "Created at":   r.created_at ? r.created_at.slice(0, 10) : "",
  }));

  downloadXlsx(rows, `customers_${range.from}_${range.to}.xlsx`);
}

async function exportExpensesXlsx(range: DateRange) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("date, category, description, amount, recurring, created_by")
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    "Date":        r.date,
    "Category":    r.category,
    "Description": r.description ?? "",
    "Amount ($)":  fmtMoney(r.amount),
    "Recurring":   r.recurring ? "Yes" : "No",
    "Created by":  r.created_by ?? "",
  }));

  downloadXlsx(rows, `expenses_${range.from}_${range.to}.xlsx`);
}

async function exportMarketingXlsx(range: DateRange) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_monthly")
    .select(
      "year, month, meta_budget, meta_leads, meta_clicks, google_budget, google_leads, google_clicks, tiktok_budget, tiktok_leads, tiktok_clicks"
    )
    .or(`and(year.gte.${range.from.slice(0, 4)},year.lte.${range.to.slice(0, 4)})`)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) throw new Error(error.message);

  const fromYM = range.from.slice(0, 7);
  const toYM   = range.to.slice(0, 7);

  const rows = (data ?? [])
    .filter((r) => {
      const ym = `${r.year}-${String(r.month).padStart(2, "0")}`;
      return ym >= fromYM && ym <= toYM;
    })
    .map((r) => {
      const totalBudget = (r.meta_budget ?? 0) + (r.google_budget ?? 0) + (r.tiktok_budget ?? 0);
      const totalLeads  = (r.meta_leads ?? 0) + (r.google_leads ?? 0) + (r.tiktok_leads ?? 0);
      const cpl = totalLeads > 0 ? totalBudget / totalLeads : 0;
      return {
        "Year":               r.year,
        "Month":              r.month,
        "META budget ($)":    fmtMoney(r.meta_budget),
        "META leads":         r.meta_leads ?? 0,
        "META clicks":        r.meta_clicks ?? 0,
        "Google budget ($)":  fmtMoney(r.google_budget),
        "Google leads":       r.google_leads ?? 0,
        "Google clicks":      r.google_clicks ?? 0,
        "TikTok budget ($)":  fmtMoney(r.tiktok_budget),
        "TikTok leads":       r.tiktok_leads ?? 0,
        "TikTok clicks":      r.tiktok_clicks ?? 0,
        "Total spend ($)":    fmtMoney(totalBudget),
        "Total leads":        totalLeads,
        "CPL ($)":            fmtMoney(cpl),
      };
    });

  downloadXlsx(rows, `marketing_${range.from}_${range.to}.xlsx`);
}

// ─── PDF exports ──────────────────────────────────────────────────────────────

async function exportProjectsPdf(range: DateRange) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_projects_rollup")
    .select("name, customer_name, op_status, fin_status, revenue, profit, created_at")
    .gte("created_at", range.from + "T00:00:00")
    .lte("created_at", range.to + "T23:59:59")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalProfit  = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const avgMargin    = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addPdfHeader(doc, "Projects Report", range);

  const body = rows.map((r, i) => {
    const rev    = r.revenue ?? 0;
    const profit = r.profit ?? 0;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;
    return [
      i + 1,
      r.name,
      r.customer_name ?? "—",
      r.op_status ?? "—",
      r.fin_status ?? "—",
      fmtMoneyDisplay(rev),
      fmtMoneyDisplay(profit),
      `${margin.toFixed(1)}%`,
    ];
  });

  autoTable(doc, {
    startY: 43,
    head: [["#", "Project", "Customer", "Status", "Fin. Status", "Revenue", "Profit", "Margin"]],
    body,
    foot: [[
      "", "", "", "", "TOTAL",
      fmtMoneyDisplay(totalRevenue),
      fmtMoneyDisplay(totalProfit),
      `${avgMargin.toFixed(1)}%`,
    ]],
    showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [244, 244, 245], textColor: [24, 24, 27], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 60 },
      2: { cellWidth: 45 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  doc.save(`projects_${range.from}_${range.to}.pdf`);
}

async function exportCustomersPdf(range: DateRange) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "name, client_type, phone, email, address_city, address_state, address_zip, customer_type, sales_tax_exempt, created_at"
    )
    .gte("created_at", range.from + "T00:00:00")
    .lte("created_at", range.to + "T23:59:59")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addPdfHeader(doc, "Customers Report", range);

  const body = rows.map((r, i) => {
    const addrParts = [r.address_city, r.address_state, r.address_zip].filter(Boolean);
    const addr = addrParts.length > 0
      ? `${r.address_city ?? ""}, ${r.address_state ?? ""} ${r.address_zip ?? ""}`.trim().replace(/^,\s*/, "")
      : "—";
    const taxExempt = r.client_type === "Business" && r.sales_tax_exempt ? "Yes" : "";
    return [
      i + 1,
      r.name,
      r.client_type ?? "Individual",
      r.phone ?? "—",
      r.email ?? "—",
      addr,
      r.customer_type ?? "—",
      taxExempt,
    ];
  });

  autoTable(doc, {
    startY: 43,
    head: [["#", "Name", "Type", "Phone", "Email", "City / State / ZIP", "Tags", "Tax Exempt"]],
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22 },
      3: { cellWidth: 35 },
      4: { cellWidth: 55 },
      5: { cellWidth: 45 },
      6: { cellWidth: 40 },
      7: { cellWidth: 20, halign: "center" },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  doc.save(`customers_${range.from}_${range.to}.pdf`);
}

// ─── Report definitions ───────────────────────────────────────────────────────

const REPORTS = [
  {
    id: "projects",
    label: "Projects",
    description: "Sales projects with revenue, profit, margin and status.",
    icon: FolderOpen,
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-100",
    xlsx: exportProjectsXlsx,
    pdf:  exportProjectsPdf,
  },
  {
    id: "customers",
    label: "Customers",
    description: "Customer list with contact info, address and tags.",
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-100",
    xlsx: exportCustomersXlsx,
    pdf:  exportCustomersPdf,
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Business expenses by category and date.",
    icon: Receipt,
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-100",
    xlsx: exportExpensesXlsx,
    pdf:  null,
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Monthly marketing spend, leads and clicks per channel.",
    icon: Megaphone,
    color: "text-pink-500",
    bg: "bg-pink-50",
    border: "border-pink-100",
    xlsx: exportMarketingXlsx,
    pdf:  null,
  },
] as const;

// Action key format: "{reportId}_xlsx" | "{reportId}_pdf"
type ActionKey = string;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [from, setFrom]         = useState(firstOfYear());
  const [to,   setTo]           = useState(today());
  const [busy, setBusy]         = useState<ActionKey | null>(null);
  const [done, setDone]         = useState<ActionKey | null>(null);
  const [errors, setErrors]     = useState<Record<ActionKey, string>>({});

  async function run(key: ActionKey, fn: (r: DateRange) => Promise<void>) {
    if (from > to) {
      setErrors((prev) => ({ ...prev, [key]: '"From" date must be before "To" date.' }));
      return;
    }
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setBusy(key);
    try {
      await fn({ from, to });
      setDone(key);
      setTimeout(() => setDone(null), 3000);
    } catch (e) {
      setErrors((prev) => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Reports</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Export data to Excel (.xlsx) or PDF</p>
      </div>

      {/* Date range */}
      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div className="flex gap-2">
          {[
            {
              label: "This month",
              f: () => {
                const n = new Date();
                const m = String(n.getMonth() + 1).padStart(2, "0");
                setFrom(`${n.getFullYear()}-${m}-01`);
                setTo(today());
              },
            },
            { label: "This year",  f: () => { setFrom(firstOfYear()); setTo(today()); } },
            { label: "All time",   f: () => { setFrom("2020-01-01");  setTo(today()); } },
          ].map(({ label, f }) => (
            <button
              key={label}
              type="button"
              onClick={f}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Report cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => {
          const Icon      = report.icon;
          const xlsxKey   = `${report.id}_xlsx`;
          const pdfKey    = `${report.id}_pdf`;
          const xlsxBusy  = busy === xlsxKey;
          const pdfBusy   = busy === pdfKey;
          const xlsxDone  = done === xlsxKey;
          const pdfDone   = done === pdfKey;
          const anyBusy   = !!busy;
          const xlsxErr   = errors[xlsxKey];
          const pdfErr    = errors[pdfKey];

          return (
            <div key={report.id} className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5">
              {/* Card header */}
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${report.bg} ${report.border}`}>
                  <Icon size={18} className={report.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900">{report.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{report.description}</p>
                </div>
              </div>

              {/* Errors */}
              {xlsxErr && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{xlsxErr}</p>
              )}
              {pdfErr && (
                <p className="mt-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{pdfErr}</p>
              )}

              {/* Buttons */}
              <div className={`mt-4 grid gap-2 ${report.pdf ? "grid-cols-2" : "grid-cols-1"}`}>
                {/* Excel button */}
                <ExportButton
                  label={`Excel`}
                  icon={<FileSpreadsheet size={14} />}
                  busy={xlsxBusy}
                  done={xlsxDone}
                  disabled={anyBusy}
                  variant="dark"
                  onClick={() => run(xlsxKey, report.xlsx)}
                />

                {/* PDF button */}
                {report.pdf && (
                  <ExportButton
                    label="PDF"
                    icon={<FileText size={14} />}
                    busy={pdfBusy}
                    done={pdfDone}
                    disabled={anyBusy}
                    variant="red"
                    onClick={() => run(pdfKey, report.pdf!)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="mt-6 text-xs text-zinc-400">
        Date range applies to: Projects → created date · Customers → created date · Expenses → expense date · Marketing → month/year.
      </p>
    </>
  );
}

// ─── ExportButton ─────────────────────────────────────────────────────────────

function ExportButton({
  label,
  icon,
  busy,
  done,
  disabled,
  variant,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  busy: boolean;
  done: boolean;
  disabled: boolean;
  variant: "dark" | "red";
  onClick: () => void;
}) {
  const base = "flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50";
  const colors = done
    ? "bg-green-600 text-white"
    : variant === "red"
    ? "bg-red-600 text-white hover:bg-red-700"
    : "bg-zinc-900 text-white hover:bg-zinc-700";

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${colors}`}>
      {busy ? (
        <><Loader2 size={14} className="animate-spin" /> Exporting...</>
      ) : done ? (
        <><Download size={14} /> Downloaded!</>
      ) : (
        <>{icon} Export {label}</>
      )}
    </button>
  );
}
