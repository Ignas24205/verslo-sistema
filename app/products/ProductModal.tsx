"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const UNITS = ["M", "PCS", "SET", "HOUR", "OTHER"];

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  supplier_price: number;
  sell_price: number;
  stock: number;
  min_stock: number;
  active: boolean;
};

type FormData = {
  name: string;
  sku: string;
  unit: string;
  supplier_price: string;
  sell_price: string;
  min_stock: string;
  active: boolean;
};

function toForm(p: Product): FormData {
  return {
    name: p.name,
    sku: p.sku ?? "",
    unit: p.unit,
    supplier_price: p.supplier_price.toString(),
    sell_price: p.sell_price.toString(),
    min_stock: p.min_stock.toString(),
    active: p.active,
  };
}

const empty: FormData = {
  name: "",
  sku: "",
  unit: "PCS",
  supplier_price: "",
  sell_price: "",
  min_stock: "",
  active: true,
};

type Props = {
  product?: Product;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProductModal({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [form, setForm] = useState<FormData>(product ? toForm(product) : empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(product ? toForm(product) : empty);
  }, [product]);

  function set(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      name: form.name,
      sku: form.sku || null,
      unit: form.unit,
      supplier_price: parseFloat(form.supplier_price) || 0,
      sell_price: parseFloat(form.sell_price) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      active: form.active,
    };

    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("products").update(payload).eq("id", product!.id)
      : await supabase.from("products").insert(payload);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? "Edit Product" : "New Product"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-5 px-6 py-5">
            <Field label="Name" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ceramic tile 60x60"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU">
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="TILE-6060"
                  className={inputCls}
                />
              </Field>
              <Field label="Unit" required>
                <select
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  className={inputCls}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier price (€)" required>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.supplier_price}
                  onChange={(e) => set("supplier_price", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
              <Field label="Default sell price (€)" required>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.sell_price}
                  onChange={(e) => set("sell_price", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Min stock">
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.min_stock}
                onChange={(e) => set("min_stock", e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>

            {isEdit && (
              <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
                <span className="text-sm font-medium text-zinc-700">Active</span>
                <button
                  type="button"
                  onClick={() => set("active", !form.active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.active ? "bg-zinc-900" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      form.active ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : isEdit ? "Save changes" : "Create product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
