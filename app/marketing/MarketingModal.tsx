"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export type MarketingRow = {
  id: string;
  year: number;
  month: number;
  meta_budget: number;
  meta_leads: number;
  meta_clicks: number;
  google_budget: number;
  google_leads: number;
  google_clicks: number;
  tiktok_budget: number;
  tiktok_leads: number;
  tiktok_clicks: number;
  created_at: string;
};

type FormData = {
  year: string;
  month: string;
  meta_budget: string;
  meta_leads: string;
  meta_clicks: string;
  google_budget: string;
  google_leads: string;
  google_clicks: string;
  tiktok_budget: string;
  tiktok_leads: string;
  tiktok_clicks: string;
};

const now = new Date();
const empty: FormData = {
  year: now.getFullYear().toString(),
  month: (now.getMonth() + 1).toString(),
  meta_budget: "",
  meta_leads: "",
  meta_clicks: "",
  google_budget: "",
  google_leads: "",
  google_clicks: "",
  tiktok_budget: "",
  tiktok_leads: "",
  tiktok_clicks: "",
};

function toForm(r: MarketingRow): FormData {
  return {
    year: r.year.toString(),
    month: r.month.toString(),
    meta_budget: r.meta_budget.toString(),
    meta_leads: r.meta_leads.toString(),
    meta_clicks: r.meta_clicks.toString(),
    google_budget: r.google_budget.toString(),
    google_leads: r.google_leads.toString(),
    google_clicks: r.google_clicks.toString(),
    tiktok_budget: r.tiktok_budget.toString(),
    tiktok_leads: r.tiktok_leads.toString(),
    tiktok_clicks: r.tiktok_clicks.toString(),
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

type Props = {
  row?: MarketingRow;
  onClose: () => void;
  onSaved: () => void;
};

export default function MarketingModal({ row, onClose, onSaved }: Props) {
  const isEdit = !!row;
  const [form, setForm] = useState<FormData>(row ? toForm(row) : empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(row ? toForm(row) : empty);
  }, [row]);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function num(val: string) {
    return parseFloat(val) || 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      year: parseInt(form.year),
      month: parseInt(form.month),
      meta_budget: num(form.meta_budget),
      meta_leads: num(form.meta_leads),
      meta_clicks: num(form.meta_clicks),
      google_budget: num(form.google_budget),
      google_leads: num(form.google_leads),
      google_clicks: num(form.google_clicks),
      tiktok_budget: num(form.tiktok_budget),
      tiktok_leads: num(form.tiktok_leads),
      tiktok_clicks: num(form.tiktok_clicks),
    };

    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("marketing_monthly").update(payload).eq("id", row!.id)
      : await supabase.from("marketing_monthly").insert(payload);

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
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? "Edit Month" : "Add Month"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Year" required>
                <select
                  value={form.year}
                  onChange={(e) => set("year", e.target.value)}
                  className={inputCls}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
              <Field label="Month" required>
                <select
                  value={form.month}
                  onChange={(e) => set("month", e.target.value)}
                  className={inputCls}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* META */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">META</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Budget (€)">
                  <input type="number" min="0" step="0.01" value={form.meta_budget}
                    onChange={(e) => set("meta_budget", e.target.value)}
                    placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Leads">
                  <input type="number" min="0" step="1" value={form.meta_leads}
                    onChange={(e) => set("meta_leads", e.target.value)}
                    placeholder="0" className={inputCls} />
                </Field>
                <Field label="Clicks">
                  <input type="number" min="0" step="1" value={form.meta_clicks}
                    onChange={(e) => set("meta_clicks", e.target.value)}
                    placeholder="0" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Google */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">Google</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Budget (€)">
                  <input type="number" min="0" step="0.01" value={form.google_budget}
                    onChange={(e) => set("google_budget", e.target.value)}
                    placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Leads">
                  <input type="number" min="0" step="1" value={form.google_leads}
                    onChange={(e) => set("google_leads", e.target.value)}
                    placeholder="0" className={inputCls} />
                </Field>
                <Field label="Clicks">
                  <input type="number" min="0" step="1" value={form.google_clicks}
                    onChange={(e) => set("google_clicks", e.target.value)}
                    placeholder="0" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* TikTok */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pink-600">TikTok</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Budget (€)">
                  <input type="number" min="0" step="0.01" value={form.tiktok_budget}
                    onChange={(e) => set("tiktok_budget", e.target.value)}
                    placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Leads">
                  <input type="number" min="0" step="1" value={form.tiktok_leads}
                    onChange={(e) => set("tiktok_leads", e.target.value)}
                    placeholder="0" className={inputCls} />
                </Field>
                <Field label="Clicks">
                  <input type="number" min="0" step="1" value={form.tiktok_clicks}
                    onChange={(e) => set("tiktok_clicks", e.target.value)}
                    placeholder="0" className={inputCls} />
                </Field>
              </div>
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
              {loading ? "Saving..." : isEdit ? "Save changes" : "Add month"}
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
