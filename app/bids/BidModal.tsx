"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const LEAD_SOURCES = ["META", "Google", "TikTok", "Referral", "Organic", "Other"];

type Customer = { id: string; name: string };

export type Bid = {
  id: string;
  name: string;
  customer_id: string | null;
  customers: { name: string } | null;
  lead_source: string;
  bid_day: string | null;
  send_day: string | null;
  materials_cost: number;
  labor_cost: number;
  won: boolean | null;
  notes: string | null;
  converted: boolean;
  created_at: string;
};

type FormData = {
  name: string;
  customer_id: string;
  lead_source: string;
  bid_day: string;
  send_day: string;
  materials_cost: string;
  labor_cost: string;
  won: string; // "true" | "false" | ""
  notes: string;
};

const empty: FormData = {
  name: "",
  customer_id: "",
  lead_source: "META",
  bid_day: "",
  send_day: "",
  materials_cost: "",
  labor_cost: "",
  won: "",
  notes: "",
};

function toForm(b: Bid): FormData {
  return {
    name: b.name,
    customer_id: b.customer_id ?? "",
    lead_source: b.lead_source,
    bid_day: b.bid_day ?? "",
    send_day: b.send_day ?? "",
    materials_cost: b.materials_cost.toString(),
    labor_cost: b.labor_cost.toString(),
    won: b.won === null ? "" : b.won ? "true" : "false",
    notes: b.notes ?? "",
  };
}

type Props = {
  bid?: Bid;
  onClose: () => void;
  onSaved: () => void;
};

export default function BidModal({ bid, onClose, onSaved }: Props) {
  const isEdit = !!bid;
  const [form, setForm] = useState<FormData>(bid ? toForm(bid) : empty);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(bid ? toForm(bid) : empty);
  }, [bid]);

  useEffect(() => {
    createClient()
      .from("customers")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCustomers(data ?? []));
  }, []);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      name: form.name,
      customer_id: form.customer_id || null,
      lead_source: form.lead_source,
      bid_day: form.bid_day || null,
      send_day: form.send_day || null,
      materials_cost: parseFloat(form.materials_cost) || 0,
      labor_cost: parseFloat(form.labor_cost) || 0,
      won: form.won === "" ? null : form.won === "true",
      notes: form.notes || null,
    };

    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("bids").update(payload).eq("id", bid!.id)
      : await supabase.from("bids").insert(payload);

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
            {isEdit ? "Edit Bid" : "New Bid"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
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
                placeholder="Kitchen renovation quote"
                className={inputCls}
              />
            </Field>

            <Field label="Customer">
              <select
                value={form.customer_id}
                onChange={(e) => set("customer_id", e.target.value)}
                className={inputCls}
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Lead source" required>
              <select
                value={form.lead_source}
                onChange={(e) => set("lead_source", e.target.value)}
                className={inputCls}
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Bid day">
                <input
                  type="date"
                  value={form.bid_day}
                  onChange={(e) => set("bid_day", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Send day">
                <input
                  type="date"
                  value={form.send_day}
                  onChange={(e) => set("send_day", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Materials (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.materials_cost}
                  onChange={(e) => set("materials_cost", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
              <Field label="Labor (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.labor_cost}
                  onChange={(e) => set("labor_cost", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Won">
              <select
                value={form.won}
                onChange={(e) => set("won", e.target.value)}
                className={inputCls}
              >
                <option value="">Pending</option>
                <option value="true">Yes — Won</option>
                <option value="false">No — Lost</option>
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any additional details..."
                className={`${inputCls} resize-none`}
              />
            </Field>

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
              {loading ? "Saving..." : isEdit ? "Save changes" : "Create bid"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
