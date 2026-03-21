"use client";

import { useEffect, useState } from "react";
import { Plus, Minus, AlertTriangle, PackageOpen, TrendingUp, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import AddStockModal, { type Product } from "./AddStockModal";
import RemoveStockModal from "./RemoveStockModal";

type Movement = {
  id: string;
  type: "add" | "remove";
  qty: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
  product: { name: string; unit: string } | null;
  project: { name: string } | null;
};

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

function fmtDate(d: string) {
  return new Date(d).toLocaleString("lt-LT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  async function fetchData() {
    const supabase = createClient();
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit, stock, supplier_price, min_stock")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("warehouse_movements")
        .select("id, type, qty, note, created_at, created_by, product:products(name, unit), project:sales(name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setProducts(prods ?? []);
    setMovements((movs as unknown as Movement[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("warehouse-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "warehouse_movements" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalValue = products.reduce((sum, p) => sum + p.stock * p.supplier_price, 0);
  const lowStockCount = products.filter((p) => p.min_stock > 0 && p.stock < p.min_stock).length;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Warehouse</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Warehouse stock and movements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            <Plus size={16} />
            Add Stock
          </button>
          <button
            onClick={() => setRemoveOpen(true)}
            className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Minus size={16} />
            Remove Stock
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-zinc-500">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Total value</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{fmt(totalValue)}</p>
          <p className="mt-0.5 text-xs text-zinc-400">qty × cost price</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-zinc-500">
            <Clock size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Ordered, not delivered</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">—</p>
          <p className="mt-0.5 text-xs text-zinc-400">Purchasing module not yet built</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-zinc-500">
            <PackageOpen size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Low stock</span>
          </div>
          <p className={`mt-2 text-2xl font-semibold ${lowStockCount > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {lowStockCount}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">products below minimum qty</p>
        </div>
      </div>

      {/* Products table */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">Products in warehouse</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr className="bg-zinc-50">
                  {["Product", "Unit", "Qty", "Min qty", "Cost price", "Value", ""].map((col) => (
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
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                      No products found. Create products in the Products section first.
                    </td>
                  </tr>
                )}
                {products.map((p) => {
                  const lowStock = p.min_stock > 0 && p.stock < p.min_stock;
                  return (
                    <tr key={p.id} className={`hover:bg-zinc-50 ${lowStock ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500">{p.unit}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`flex items-center gap-1.5 font-medium ${lowStock ? "text-red-600" : "text-zinc-900"}`}>
                          {lowStock && <AlertTriangle size={13} />}
                          {fmtQty(p.stock)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">{fmtQty(p.min_stock)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900">{fmt(p.supplier_price)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                        {fmt(p.stock * p.supplier_price)}
                      </td>
                      <td className="px-4 py-3">
                        {lowStock && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200">
                            <AlertTriangle size={10} />
                            Low stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Movement history */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">Movement history</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr className="bg-zinc-50">
                  {["Date", "Type", "Product", "Qty", "Project", "Note", "By"].map((col) => (
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
                {!loading && movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                      No movements yet.
                    </td>
                  </tr>
                )}
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          m.type === "add"
                            ? "bg-green-50 text-green-700 ring-green-200"
                            : "bg-red-50 text-red-600 ring-red-200"
                        }`}
                      >
                        {m.type === "add" ? <Plus size={10} /> : <Minus size={10} />}
                        {m.type === "add" ? "Added" : "Removed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {m.product?.name ?? "—"}
                      {m.product?.unit && (
                        <span className="ml-1 text-zinc-400">({m.product.unit})</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${m.type === "add" ? "text-green-700" : "text-red-600"}`}>
                      {m.type === "add" ? "+" : "−"}{fmtQty(m.qty)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{m.project?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{m.note ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{m.created_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {addOpen && (
        <AddStockModal
          products={products}
          onClose={() => setAddOpen(false)}
          onSaved={fetchData}
        />
      )}
      {removeOpen && (
        <RemoveStockModal
          products={products}
          onClose={() => setRemoveOpen(false)}
          onSaved={fetchData}
        />
      )}
    </>
  );
}
