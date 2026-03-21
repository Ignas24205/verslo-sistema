"use client";

import { useEffect, useState } from "react";
import { X, Building2, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export type Customer = {
  id: string;
  name: string;
  client_type: "Business" | "Individual" | null;
  company_name: string | null;
  company_code: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  sales_tax_exempt: boolean;
  notes: string | null;
  customer_type: string | null; // used as "tags" in UI
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type FormData = {
  client_type: "Business" | "Individual";
  company_name: string;
  company_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  sales_tax_exempt: boolean;
  notes: string;
  tags: string; // maps to customer_type column
};

const empty: FormData = {
  client_type: "Individual",
  company_name: "",
  company_code: "",
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  address_street: "",
  address_city: "",
  address_state: "FL",
  address_zip: "",
  sales_tax_exempt: false,
  notes: "",
  tags: "",
};

function toForm(c: Customer): FormData {
  return {
    client_type: c.client_type === "Business" ? "Business" : "Individual",
    company_name: c.company_name ?? "",
    company_code: c.company_code ?? "",
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address_street: c.address_street ?? "",
    address_city: c.address_city ?? "",
    address_state: c.address_state ?? "FL",
    address_zip: c.address_zip ?? "",
    sales_tax_exempt: c.sales_tax_exempt ?? false,
    notes: c.notes ?? "",
    tags: c.customer_type ?? "",
  };
}

function deriveName(form: FormData): string {
  if (form.client_type === "Business") {
    return form.company_name.trim();
  }
  return `${form.first_name} ${form.last_name}`.trim();
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

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Reset sales_tax_exempt when switching to Individual
  function setClientType(type: "Business" | "Individual") {
    setForm((prev) => ({
      ...prev,
      client_type: type,
      sales_tax_exempt: type === "Individual" ? false : prev.sales_tax_exempt,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = deriveName(form);
    if (!name) {
      setError(
        form.client_type === "Business"
          ? "Company name is required."
          : "First name or last name is required."
      );
      return;
    }

    setLoading(true);

    const payload = {
      name,
      client_type: form.client_type,
      company_name: form.client_type === "Business" ? form.company_name.trim() || null : null,
      company_code: form.client_type === "Business" ? form.company_code.trim() || null : null,
      first_name: form.client_type === "Individual" ? form.first_name.trim() || null : null,
      last_name: form.client_type === "Individual" ? form.last_name.trim() || null : null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address_street: form.address_street.trim() || null,
      address_city: form.address_city.trim() || null,
      address_state: form.address_state.trim() || "FL",
      address_zip: form.address_zip.trim() || null,
      sales_tax_exempt: form.client_type === "Business" ? form.sales_tax_exempt : false,
      notes: form.notes.trim() || null,
      customer_type: form.tags.trim() || null,
    };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email ?? null;

    const { error: dbErr } = isEdit
      ? await supabase.from("customers").update({ ...payload, updated_by: userEmail }).eq("id", customer!.id)
      : await supabase.from("customers").insert({ ...payload, created_by: userEmail, updated_by: userEmail });

    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }

    onSaved();
    onClose();
  }

  const isBusiness = form.client_type === "Business";

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

            {/* Client type toggle */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Client type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Individual", "Business"] as const).map((type) => {
                  const Icon = type === "Business" ? Building2 : User;
                  const active = form.client_type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setClientType(type)}
                      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Icon size={15} />
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Business fields */}
            {isBusiness && (
              <>
                <Field label="Company name" required>
                  <input
                    type="text"
                    required
                    value={form.company_name}
                    onChange={(e) => set("company_name", e.target.value)}
                    placeholder="Acme UAB"
                    className={inputCls}
                  />
                </Field>
                <Field label="Company code">
                  <input
                    type="text"
                    value={form.company_code}
                    onChange={(e) => set("company_code", e.target.value)}
                    placeholder="123456789"
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            {/* Individual fields */}
            {!isBusiness && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" required>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    placeholder="Jonas"
                    className={inputCls}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                    placeholder="Jonaitis"
                    className={inputCls}
                  />
                </Field>
              </div>
            )}

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 (407) 000-0000"
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="name@example.com"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Address */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Address</p>
              <div className="flex flex-col gap-3">
                <Field label="Street address">
                  <input
                    type="text"
                    value={form.address_street}
                    onChange={(e) => set("address_street", e.target.value)}
                    placeholder="123 Main St"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <Field label="City">
                      <input
                        type="text"
                        value={form.address_city}
                        onChange={(e) => set("address_city", e.target.value)}
                        placeholder="Orlando"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div className="col-span-1">
                    <Field label="State">
                      <input
                        type="text"
                        maxLength={2}
                        value={form.address_state}
                        onChange={(e) => set("address_state", e.target.value.toUpperCase())}
                        placeholder="FL"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="ZIP code">
                      <input
                        type="text"
                        maxLength={10}
                        value={form.address_zip}
                        onChange={(e) => set("address_zip", e.target.value)}
                        placeholder="32801"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Tax Exempt — Business only */}
            {isBusiness && (
              <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-700">Sales Tax Exempt</p>
                  <p className="mt-0.5 text-xs text-zinc-400">Customer has a tax exemption certificate</p>
                </div>
                <button
                  type="button"
                  onClick={() => set("sales_tax_exempt", !form.sales_tax_exempt)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.sales_tax_exempt ? "bg-zinc-900" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      form.sales_tax_exempt ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Tags */}
            <Field label="Tags">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="VIP, Referral, Wholesale..."
                className={inputCls}
              />
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any notes about this customer..."
                className={`${inputCls} resize-none`}
              />
            </Field>

            {/* Audit trail */}
            {isEdit && (customer?.created_by || customer?.updated_by) && (
              <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2.5 space-y-1">
                {customer.created_by && (
                  <p className="text-xs text-zinc-400">
                    Created by: <span className="text-zinc-600">{customer.created_by}</span>
                  </p>
                )}
                {customer.updated_by && (
                  <p className="text-xs text-zinc-400">
                    Last updated by: <span className="text-zinc-600">{customer.updated_by}</span>
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
