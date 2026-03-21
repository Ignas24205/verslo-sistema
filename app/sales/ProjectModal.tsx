"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const LEAD_SOURCES = ["META", "Google", "TikTok", "Referral", "Organic", "Other"];
const OP_STATUSES = ["In progress", "Finished"];
const FIN_STATUSES = ["Not invoiced", "Invoiced", "Paid", "Overdue"];

type Customer = { id: string; name: string };
type CustomerPrice = { product_id: string; sell_price: number; customer_id: string | null; valid_from: string | null };

export type Project = {
  id: string;
  name: string;
  customer_id: string | null;
  customers: { name: string } | null;
  lead_source: string;
  op_status: string;
  fin_status: string;
  start_date: string | null;
  end_date: string | null;
  invoice_date: string | null;
  work_revenue: number;
  material_revenue: number;
  material_cost: number;
  extra_costs: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type FormData = {
  name: string;
  customer_id: string;
  lead_source: string;
  op_status: string;
  fin_status: string;
  start_date: string;
  end_date: string;
  invoice_date: string;
  work_revenue: string;
  extra_costs: string;
  notes: string;
};

const empty: FormData = {
  name: "",
  customer_id: "",
  lead_source: "META",
  op_status: "In progress",
  fin_status: "Not invoiced",
  start_date: "",
  end_date: "",
  invoice_date: "",
  work_revenue: "",
  extra_costs: "",
  notes: "",
};

function toForm(p: Project): FormData {
  return {
    name: p.name,
    customer_id: p.customer_id ?? "",
    lead_source: p.lead_source,
    op_status: p.op_status,
    fin_status: p.fin_status,
    start_date: p.start_date ?? "",
    end_date: p.end_date ?? "",
    invoice_date: p.invoice_date ?? "",
    work_revenue: p.work_revenue.toString(),
    extra_costs: p.extra_costs.toString(),
    notes: p.notes ?? "",
  };
}

type Props = {
  project?: Project;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProjectModal({ project, onClose, onSaved }: Props) {
  const isEdit = !!project;
  const [form, setForm] = useState<FormData>(project ? toForm(project) : empty);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([]);
  const [priceSuggestion, setPriceSuggestion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(project ? toForm(project) : empty);
  }, [project]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("customer_prices").select("product_id, sell_price, customer_id, valid_from"),
    ]).then(([{ data: custs }, { data: prices }]) => {
      setCustomers(custs ?? []);
      setCustomerPrices(prices ?? []);
    });
  }, []);

  // Suggest work revenue from pricebook when customer changes
  useEffect(() => {
    if (!form.customer_id || customerPrices.length === 0) {
      setPriceSuggestion(null);
      return;
    }
    const matches = customerPrices.filter((cp) => cp.customer_id === form.customer_id);
    if (matches.length === 0) {
      setPriceSuggestion(null);
      return;
    }
    // Pick the most recent valid price
    const sorted = [...matches].sort((a, b) => {
      if (!a.valid_from && !b.valid_from) return 0;
      if (!a.valid_from) return 1;
      if (!b.valid_from) return -1;
      return b.valid_from.localeCompare(a.valid_from);
    });
    setPriceSuggestion(sorted[0].sell_price);
  }, [form.customer_id, customerPrices]);

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
      op_status: form.op_status,
      fin_status: form.fin_status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      invoice_date: form.invoice_date || null,
      work_revenue: parseFloat(form.work_revenue) || 0,
      extra_costs: parseFloat(form.extra_costs) || 0,
      notes: form.notes || null,
    };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email ?? null;

    const { error } = isEdit
      ? await supabase.from("projects").update({ ...payload, updated_by: userEmail }).eq("id", project!.id)
      : await supabase.from("projects").insert({ ...payload, created_by: userEmail, updated_by: userEmail });

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
            {isEdit ? "Edit Project" : "New Project"}
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
            <Field label="Project name" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Kitchen renovation"
                className={inputCls}
              />
            </Field>

            <Field label="Customer" required>
              <select
                required
                value={form.customer_id}
                onChange={(e) => set("customer_id", e.target.value)}
                className={inputCls}
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {priceSuggestion !== null && !isEdit && (
              <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5">
                <span className="text-xs text-blue-700">
                  Pricebook suggests <strong>€{priceSuggestion.toFixed(2)}</strong> for this customer
                </span>
                <button
                  type="button"
                  onClick={() => set("work_revenue", priceSuggestion.toString())}
                  className="ml-3 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Apply
                </button>
              </div>
            )}

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

            {isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status">
                  <select
                    value={form.op_status}
                    onChange={(e) => set("op_status", e.target.value)}
                    className={inputCls}
                  >
                    {OP_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Financial status">
                  <select
                    value={form.fin_status}
                    onChange={(e) => set("fin_status", e.target.value)}
                    className={inputCls}
                  >
                    {FIN_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Planned invoice date">
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => set("invoice_date", e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Work revenue (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.work_revenue}
                  onChange={(e) => set("work_revenue", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
              <Field label="Extra costs (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.extra_costs}
                  onChange={(e) => set("extra_costs", e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
            </div>

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
              {loading ? "Saving..." : isEdit ? "Save changes" : "Create project"}
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
