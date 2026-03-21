"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import PriceModal, { type CustomerPrice } from "./PriceModal";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PricebookPage() {
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerPrice | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchPrices() {
    const supabase = createClient();
    const { data } = await supabase
      .from("customer_prices")
      .select("*, products(name, unit), customers(name)")
      .order("products(name)", { ascending: true });
    setPrices((data as CustomerPrice[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPrices();
    const supabase = createClient();
    const ch = supabase
      .channel("pricebook-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_prices" }, fetchPrices)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(p: CustomerPrice) {
    setEditing(p);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("customer_prices").delete().eq("id", deleteId);
    setDeleteId(null);
    setDeleting(false);
    fetchPrices();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Pricebook</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Customer-specific product prices</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          Add Price
        </button>
      </div>

      {/* Info banner */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <BookOpen size={15} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          Prices defined here are automatically suggested in the Sales form when a customer is selected.
          Set a price per specific customer, or use Customer Type for group pricing.
        </p>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="bg-zinc-50">
                {["Product", "Customer", "Customer Type", "Sell Price", "Valid From", ""].map((col) => (
                  <th
                    key={col}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
                      col === "Sell Price" ? "text-right" : "text-left"
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
              {!loading && prices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No prices yet. Click &ldquo;Add Price&rdquo; to get started.
                  </td>
                </tr>
              )}
              {prices.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {p.products?.name ?? "—"}
                    {p.products?.unit && (
                      <span className="ml-1.5 text-xs text-zinc-400">({p.products.unit})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {p.customers?.name ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {p.customer_type ? (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                        {p.customer_type}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {fmt(p.sell_price)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{fmtDate(p.valid_from)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
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
        <PriceModal
          price={editing}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
          onSaved={fetchPrices}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete price?</h3>
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
