"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export const CATEGORIES = [
  "Phone",
  "Fuel",
  "Software",
  "Domain",
  "Office",
  "Marketing",
  "Other",
] as const;

export type Expense = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  recurring: boolean;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type FormData = {
  date: string;
  category: string;
  description: string;
  amount: string;
  recurring: boolean;
};

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

const empty: FormData = {
  date: todayIso(),
  category: "Other",
  description: "",
  amount: "",
  recurring: false,
};

function toForm(e: Expense): FormData {
  return {
    date: e.date,
    category: e.category,
    description: e.description ?? "",
    amount: e.amount.toString(),
    recurring: e.recurring,
  };
}

type Props = {
  expense?: Expense;
  onClose: () => void;
  onSaved: () => void;
};

export default function ExpenseModal({ expense, onClose, onSaved }: Props) {
  const isEdit = !!expense;
  const [form, setForm] = useState<FormData>(expense ? toForm(expense) : empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(expense ? toForm(expense) : empty);
  }, [expense]);

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      date: form.date,
      category: form.category,
      description: form.description.trim() || null,
      amount: parseFloat(form.amount) || 0,
      recurring: form.recurring,
    };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email ?? null;

    const { error: dbErr } = isEdit
      ? await supabase
          .from("expenses")
          .update({ ...payload, updated_by: userEmail })
          .eq("id", expense!.id)
      : await supabase
          .from("expenses")
          .insert({ ...payload, created_by: userEmail, updated_by: userEmail });

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
            {isEdit ? "Edit Expense" : "Add Expense"}
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

            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" required>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Category" required>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={inputCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <input
                type="text"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="e.g. Monthly Slack subscription"
                className={inputCls}
              />
            </Field>

            <Field label="Amount (€)" required>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>

            <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-700">Recurring</p>
                <p className="text-xs text-zinc-400 mt-0.5">Monthly repeating expense</p>
              </div>
              <button
                type="button"
                onClick={() => set("recurring", !form.recurring)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.recurring ? "bg-zinc-900" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    form.recurring ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>

            {isEdit && (expense?.created_by || expense?.updated_by) && (
              <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2.5 space-y-1">
                {expense.created_by && (
                  <p className="text-xs text-zinc-400">
                    Created by: <span className="text-zinc-600">{expense.created_by}</span>
                  </p>
                )}
                {expense.updated_by && (
                  <p className="text-xs text-zinc-400">
                    Last updated by: <span className="text-zinc-600">{expense.updated_by}</span>
                  </p>
                )}
              </div>
            )}

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
              {loading ? "Saving..." : isEdit ? "Save changes" : "Add expense"}
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
