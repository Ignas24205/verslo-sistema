"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Product } from "./AddStockModal";

type Project = { id: string; name: string };

type Props = {
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
};

export default function RemoveStockModal({ products, onClose, onSaved }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sales")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data }) => setProjects(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qtyNum = parseFloat(qty);
    if (!productId || isNaN(qtyNum) || qtyNum <= 0) {
      setError("Select a product and enter a positive quantity.");
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (qtyNum > product.stock) {
      setError(`Not enough in stock. Current quantity: ${product.stock}`);
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email ?? null;

    const { error: movErr } = await supabase.from("warehouse_movements").insert({
      product_id: productId,
      type: "remove",
      qty: qtyNum,
      project_id: projectId || null,
      note: note.trim() || null,
      created_by: userEmail,
    });
    if (movErr) { setError(movErr.message); setSaving(false); return; }

    const { error: stockErr } = await supabase
      .from("products")
      .update({ stock: product.stock - qtyNum })
      .eq("id", productId);
    if (stockErr) { setError(stockErr.message); setSaving(false); return; }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-900">Remove Stock</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit}) — in stock: {p.stock}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Quantity</label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">— none —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="e.g. Write-off"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Remove"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
