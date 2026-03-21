"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Product = { id: string; name: string; unit: string; sell_price: number };
type Customer = { id: string; name: string };

export type CustomerPrice = {
  id: string;
  product_id: string;
  customer_id: string | null;
  customer_type: string | null;
  sell_price: number;
  valid_from: string | null;
  products: { name: string; unit: string } | null;
  customers: { name: string } | null;
};

type FormData = {
  product_id: string;
  customer_id: string;
  customer_type: string;
  sell_price: string;
  valid_from: string;
};

const empty: FormData = {
  product_id: "",
  customer_id: "",
  customer_type: "",
  sell_price: "",
  valid_from: "",
};

function toForm(cp: CustomerPrice): FormData {
  return {
    product_id: cp.product_id,
    customer_id: cp.customer_id ?? "",
    customer_type: cp.customer_type ?? "",
    sell_price: cp.sell_price.toString(),
    valid_from: cp.valid_from ?? "",
  };
}

type Props = {
  price?: CustomerPrice;
  onClose: () => void;
  onSaved: () => void;
};

export default function PriceModal({ price, onClose, onSaved }: Props) {
  const isEdit = !!price;
  const [form, setForm] = useState<FormData>(price ? toForm(price) : empty);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(price ? toForm(price) : empty);
  }, [price]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("products").select("id, name, unit, sell_price").eq("active", true).order("name"),
      supabase.from("customers").select("id, name").order("name"),
    ]).then(([{ data: prods }, { data: custs }]) => {
      setProducts(prods ?? []);
      setCustomers(custs ?? []);
    });
  }, []);

  // When product changes, suggest its default sell price
  function handleProductChange(productId: string) {
    setForm((prev) => {
      const product = products.find((p) => p.id === productId);
      return {
        ...prev,
        product_id: productId,
        sell_price: product ? product.sell_price.toString() : prev.sell_price,
      };
    });
  }

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      product_id: form.product_id,
      customer_id: form.customer_id || null,
      customer_type: form.customer_type.trim() || null,
      sell_price: parseFloat(form.sell_price) || 0,
      valid_from: form.valid_from || null,
    };

    const supabase = createClient();
    const { error: dbErr } = isEdit
      ? await supabase.from("customer_prices").update(payload).eq("id", price!.id)
      : await supabase.from("customer_prices").insert(payload);

    if (dbErr) {
      setError(dbErr.message);
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
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? "Edit Price" : "Add Price"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-5 px-6 py-5">

            <Field label="Product" required>
              <select
                required
                value={form.product_id}
                onChange={(e) => handleProductChange(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Customer">
              <select
                value={form.customer_id}
                onChange={(e) => set("customer_id", e.target.value)}
                className={inputCls}
              >
                <option value="">— All customers / by type —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Customer type">
              <input
                type="text"
                value={form.customer_type}
                onChange={(e) => set("customer_type", e.target.value)}
                placeholder="e.g. Wholesale, Retail, VIP"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-zinc-400">
                Use either a specific customer or a customer type, not both.
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Sell price (€)" required>
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
              <Field label="Valid from">
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => set("valid_from", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
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
              {loading ? "Saving..." : isEdit ? "Save changes" : "Add price"}
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
