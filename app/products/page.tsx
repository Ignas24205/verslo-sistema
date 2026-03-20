"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ProductModal, { type Product } from "./ProductModal";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(3).replace(/\.?0+$/, "");
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchProducts() {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });
    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();

    const supabase = createClient();
    const channel = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => fetchProducts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("products").delete().eq("id", deleteId);
    setDeleteId(null);
    setDeleting(false);
    fetchProducts();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          New Product
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead>
              <tr className="bg-zinc-50">
                {["Name", "SKU", "Unit", "Supplier Price", "Default Sell Price", "Stock", "Min Stock", "Active", ""].map(
                  (col) => (
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
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">
                    No products yet. Add your first one.
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const lowStock = p.min_stock > 0 && p.stock < p.min_stock;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {p.sku ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{p.unit}</td>
                    <td className="px-4 py-3 text-sm text-zinc-900">
                      {fmt(p.supplier_price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-900">
                      {fmt(p.sell_price)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`flex items-center gap-1 ${
                          lowStock ? "text-red-600" : "text-zinc-900"
                        }`}
                      >
                        {lowStock && <AlertTriangle size={13} />}
                        {fmtQty(p.stock)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {fmtQty(p.min_stock)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          p.active
                            ? "bg-green-50 text-green-700 ring-green-200"
                            : "bg-zinc-100 text-zinc-500 ring-zinc-200"
                        }`}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSaved={fetchProducts}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete product?</h3>
            <p className="mt-1 text-sm text-zinc-500">
              This action cannot be undone.
            </p>
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
