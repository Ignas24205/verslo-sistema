"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const LEAD_SOURCES = ["META", "Google", "TikTok", "Referral", "Organic", "Other"];
const OP_STATUSES = ["In progress", "Finished"];
const FIN_STATUSES = ["Not invoiced", "Invoiced", "Paid", "Overdue"];

type Customer = { id: string; name: string };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(project ? toForm(project) : empty);
  }, [project]);

  useEffect(() => {
    const supabase = createClient();
    supabase
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
    const { error } = isEdit
      ? await supabase.from("projects").update(payload).eq("id", project!.id)
      : await supabase.from("projects").insert(payload);

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
