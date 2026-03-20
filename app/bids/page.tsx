"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowRightCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import BidModal, { type Bid } from "./BidModal";

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

const wonStyles: Record<string, string> = {
  won: "bg-green-50 text-green-700 ring-green-200",
  lost: "bg-red-50 text-red-700 ring-red-200",
  pending: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

function WonBadge({ won }: { won: boolean | null }) {
  const key = won === null ? "pending" : won ? "won" : "lost";
  const label = won === null ? "Pending" : won ? "Won" : "Lost";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${wonStyles[key]}`}>
      {label}
    </span>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

export default function BidsPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bid | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  async function fetchBids() {
    const supabase = createClient();
    const { data } = await supabase
      .from("bids")
      .select("*, customers(name)")
      .order("created_at", { ascending: false });
    setBids((data as Bid[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchBids();
    const supabase = createClient();
    const channel = supabase
      .channel("bids-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, fetchBids)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(b: Bid) {
    setEditing(b);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await createClient().from("bids").delete().eq("id", deleteId);
    setDeleteId(null);
    setDeleting(false);
    fetchBids();
  }

  async function convertToProject(bid: Bid) {
    setConverting(bid.id);
    const supabase = createClient();
    const { error } = await supabase.from("projects").insert({
      name: bid.name,
      customer_id: bid.customer_id,
      lead_source: bid.lead_source,
      op_status: "In progress",
      fin_status: "Not invoiced",
      work_revenue: bid.labor_cost,
      material_revenue: bid.materials_cost,
      material_cost: 0,
      extra_costs: 0,
      notes: bid.notes,
    });

    if (!error) {
      await supabase.from("bids").update({ converted: true }).eq("id", bid.id);
      fetchBids();
    }
    setConverting(null);
  }

  // KPI calculations
  const decided = bids.filter((b) => b.won !== null);
  const won = bids.filter((b) => b.won === true);
  const winRate = decided.length > 0 ? (won.length / decided.length) * 100 : 0;
  const totalSum = bids.reduce((acc, b) => acc + b.materials_cost + b.labor_cost, 0);
  const avgValue = bids.length > 0 ? totalSum / bids.length : 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Bids</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {bids.length} bid{bids.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          New Bid
        </button>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-3 gap-4">
        <KpiCard label="Total Bids" value={bids.length.toString()} />
        <KpiCard label="Win Rate" value={decided.length > 0 ? `${winRate.toFixed(0)}%` : "—"} />
        <KpiCard label="Avg Bid Value" value={bids.length > 0 ? fmt(avgValue) : "—"} />
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead>
              <tr className="bg-zinc-50">
                {["Name", "Customer", "Lead Source", "Bid Day", "Total", "Won", ""].map((col) => (
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
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">Loading...</td>
                </tr>
              )}
              {!loading && bids.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">No bids yet. Create your first one.</td>
                </tr>
              )}
              {bids.map((b) => {
                const total = b.materials_cost + b.labor_cost;
                const canConvert = b.won === true && !b.converted;
                return (
                  <tr key={b.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{b.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{b.customers?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{b.lead_source}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{fmtDate(b.bid_day)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{fmt(total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <WonBadge won={b.won} />
                        {b.converted && (
                          <span className="text-xs text-zinc-400">converted</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canConvert && (
                          <button
                            onClick={() => convertToProject(b)}
                            disabled={converting === b.id}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                            title="Convert to Project"
                          >
                            <ArrowRightCircle size={13} />
                            {converting === b.id ? "Converting..." : "Convert"}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(b)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(b.id)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
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

      {/* Modal */}
      {modalOpen && (
        <BidModal
          bid={editing}
          onClose={() => setModalOpen(false)}
          onSaved={fetchBids}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete bid?</h3>
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
