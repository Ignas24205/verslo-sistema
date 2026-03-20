"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export type Customer = {
  id: string;
  name: string;
  customer_type: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

type FormData = {
  name: string;
  customer_type: string;
  phone: string;
  email: string;
};

const empty: FormData = { name: "", customer_type: "", phone: "", email: "" };

function toForm(c: Customer): FormData {
  return {
    name: c.name,
    customer_type: c.customer_type ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
  };
}

type Props = {
  customer?: Customer;
  onClose: () => void;
  onSaved: () => void;
};

export default function CustomerModal({ customer, onClose, onSaved }: Props) {
  const isEdit = !!customer;
  const [form, setForm] = useState<FormData>(customer ? toForm(customer) : empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(customer ? toForm(customer) : empty);
  }, [customer]);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      name: form.name,
      customer_type: form.customer_type || null,
      phone: form.phone || null,
      email: form.email || null,
    };

    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("customers").update(payload).eq("id", customer!.id)
      : await supabase.from("customers").insert(payload);

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
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? "Edit Customer" : "New Customer"}
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
            <Field label="Name" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="John Smith"
                className={inputCls}
              />
            </Field>

            <Field label="Customer type">
              <input
                type="text"
                value={form.customer_type}
                onChange={(e) => set("customer_type", e.target.value)}
                placeholder="A, B, C or VIP..."
                className={inputCls}
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+370 600 00000"
                className={inputCls}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="john@example.com"
                className={inputCls}
              />
            </Field>

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
              {loading ? "Saving..." : isEdit ? "Save changes" : "Create customer"}
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
