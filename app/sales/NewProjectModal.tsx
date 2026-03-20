"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const LEAD_SOURCES = ["META", "Google", "TikTok", "Referral", "Organic", "Other"];

type FormData = {
  name: string;
  client: string;
  lead_source: string;
  start_date: string;
  end_date: string;
  invoice_date: string;
  work_revenue: string;
  extra_costs: string;
  notes: string;
};

const empty: FormData = {
  name: "",
  client: "",
  lead_source: "META",
  start_date: "",
  end_date: "",
  invoice_date: "",
  work_revenue: "",
  extra_costs: "",
  notes: "",
};

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export default function NewProjectModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormData>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from("projects").insert({
      name: form.name,
      client: form.client,
      lead_source: form.lead_source,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      invoice_date: form.invoice_date || null,
      work_revenue: parseFloat(form.work_revenue) || 0,
      extra_costs: parseFloat(form.extra_costs) || 0,
      notes: form.notes || null,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">New Project</h2>
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
            {/* Project name */}
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

            {/* Client */}
            <Field label="Client" required>
              <input
                type="text"
                required
                value={form.client}
                onChange={(e) => set("client", e.target.value)}
                placeholder="John Smith"
                className={inputCls}
              />
            </Field>

            {/* Lead source */}
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

            {/* Dates */}
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

            {/* Invoice date */}
            <Field label="Planned invoice date">
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => set("invoice_date", e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Financials */}
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

            {/* Notes */}
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
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
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
              {loading ? "Saving..." : "Create project"}
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
