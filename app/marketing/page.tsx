"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, TrendingUp, Users, Target, Award } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import MarketingModal, { type MarketingRow } from "./MarketingModal";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCpl(n: number) {
  if (!isFinite(n) || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function cpl(budget: number, leads: number) {
  return leads > 0 ? budget / leads : Infinity;
}

function bestChannel(rows: MarketingRow[]): string {
  if (rows.length === 0) return "—";

  const totals = {
    META: { budget: 0, leads: 0 },
    Google: { budget: 0, leads: 0 },
    TikTok: { budget: 0, leads: 0 },
  };

  for (const r of rows) {
    totals.META.budget += r.meta_budget;
    totals.META.leads += r.meta_leads;
    totals.Google.budget += r.google_budget;
    totals.Google.leads += r.google_leads;
    totals.TikTok.budget += r.tiktok_budget;
    totals.TikTok.leads += r.tiktok_leads;
  }

  let best = "—";
  let bestCpl = Infinity;

  for (const [channel, { budget, leads }] of Object.entries(totals)) {
    if (leads === 0) continue;
    const c = budget / leads;
    if (c < bestCpl) {
      bestCpl = c;
      best = channel;
    }
  }

  return best;
}

export default function MarketingPage() {
  const [rows, setRows] = useState<MarketingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<MarketingRow | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchData() {
    const supabase = createClient();
    const { data } = await supabase
      .from("marketing_monthly")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("marketing_monthly").delete().eq("id", id);
    setDeleteId(null);
    fetchData();
  }

  // KPI calculations
  const totalSpend = rows.reduce((s, r) => s + r.meta_budget + r.google_budget + r.tiktok_budget, 0);
  const totalLeads = rows.reduce((s, r) => s + r.meta_leads + r.google_leads + r.tiktok_leads, 0);
  const totalCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const best = bestChannel(rows);

  const kpis = [
    {
      label: "Total Spend",
      value: fmt(totalSpend),
      sub: "All channels, all months",
      icon: TrendingUp,
      color: "text-zinc-500",
    },
    {
      label: "Total Leads",
      value: totalLeads.toString(),
      sub: "All channels, all months",
      icon: Users,
      color: "text-zinc-500",
    },
    {
      label: "CPL",
      value: fmtCpl(totalCpl),
      sub: "Cost per Lead (average)",
      icon: Target,
      color: "text-zinc-500",
    },
    {
      label: "Best Channel",
      value: best,
      sub: "Lowest CPL",
      icon: Award,
      color: best === "META" ? "text-blue-500" : best === "Google" ? "text-green-500" : best === "TikTok" ? "text-pink-500" : "text-zinc-500",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Marketing</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Monthly spend and KPI by channel</p>
        </div>
        <button
          onClick={() => { setEditRow(undefined); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          Add Month
        </button>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className={`flex items-center gap-2 ${kpi.color}`}>
              <kpi.icon size={16} />
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{kpi.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Monthly data</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Month</th>

                  {/* META */}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-blue-500">META Budget</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-blue-500">META Leads</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-blue-500">META Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-blue-400">META CPL</th>

                  {/* Google */}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-green-600">Google Budget</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-green-600">Google Leads</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-green-600">Google Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-green-500">Google CPL</th>

                  {/* TikTok */}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-pink-600">TikTok Budget</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-pink-600">TikTok Leads</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-pink-600">TikTok Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-pink-500">TikTok CPL</th>

                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-zinc-400">Loading...</td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-zinc-400">
                      No data yet. Click &quot;Add Month&quot; to get started.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const metaCpl = cpl(r.meta_budget, r.meta_leads);
                  const googleCpl = cpl(r.google_budget, r.google_leads);
                  const tiktokCpl = cpl(r.tiktok_budget, r.tiktok_leads);
                  return (
                    <tr key={r.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{r.year}</td>
                      <td className="px-4 py-3 text-zinc-700">{MONTHS[r.month - 1]}</td>

                      {/* META */}
                      <td className="px-4 py-3 text-right text-zinc-900">{fmt(r.meta_budget)}</td>
                      <td className="px-4 py-3 text-right text-zinc-900">{r.meta_leads}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{r.meta_clicks}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{fmtCpl(metaCpl)}</td>

                      {/* Google */}
                      <td className="px-4 py-3 text-right text-zinc-900">{fmt(r.google_budget)}</td>
                      <td className="px-4 py-3 text-right text-zinc-900">{r.google_leads}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{r.google_clicks}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{fmtCpl(googleCpl)}</td>

                      {/* TikTok */}
                      <td className="px-4 py-3 text-right text-zinc-900">{fmt(r.tiktok_budget)}</td>
                      <td className="px-4 py-3 text-right text-zinc-900">{r.tiktok_leads}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{r.tiktok_clicks}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{fmtCpl(tiktokCpl)}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditRow(r); setModalOpen(true); }}
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(r.id)}
                            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <MarketingModal
          row={editRow}
          onClose={() => { setModalOpen(false); setEditRow(undefined); }}
          onSaved={fetchData}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete record?</h3>
            <p className="mt-1 text-sm text-zinc-500">This action cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
