"use client";

import { useMemo, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import CustomerModal, { type Customer } from "./CustomerModal";

type TypeFilter = "All" | "Business" | "Individual";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [search, setSearch] = useState("");

  async function fetchCustomers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchCustomers();
    const supabase = createClient();
    const channel = supabase
      .channel("customers-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, fetchCustomers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const typeMatch =
        typeFilter === "All" ||
        (c.client_type ?? "Individual") === typeFilter;
      const q = search.toLowerCase();
      const searchMatch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.customer_type ?? "").toLowerCase().includes(q);
      return typeMatch && searchMatch;
    });
  }, [customers, typeFilter, search]);

  const counts = useMemo(() => ({
    Business: customers.filter((c) => c.client_type === "Business").length,
    Individual: customers.filter((c) => (c.client_type ?? "Individual") === "Individual").length,
  }), [customers]);

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("customers").delete().eq("id", deleteId);
    setDeleteId(null);
    setDeleting(false);
    fetchCustomers();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
            {" · "}
            <span className="text-zinc-400">{counts.Business} business · {counts.Individual} individual</span>
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          New Customer
        </button>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/* Type filter pills */}
        <div className="flex gap-1">
          {(["All", "Business", "Individual"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {t === "Business" && <Building2 size={11} />}
              {t === "Individual" && <User size={11} />}
              {t}
              {t !== "All" && (
                <span className={`ml-0.5 ${typeFilter === t ? "opacity-70" : "text-zinc-400"}`}>
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, tags..."
          className="ml-auto rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 w-64"
        />
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="bg-zinc-50">
                {["Name", "Type", "Contact", "Address", "Tags", "Added", ""].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    {customers.length === 0
                      ? "No customers yet. Add your first one."
                      : "No customers match the current filters."}
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const isBusiness = c.client_type === "Business";
                const addressLine = [c.address_city, c.address_state].filter(Boolean).join(", ");
                const addressFull = [c.address_street, addressLine, c.address_zip].filter(Boolean).join(" · ");
                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          isBusiness ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-500"
                        }`}>
                          {isBusiness ? <Building2 size={12} /> : <User size={12} />}
                        </span>
                        <div>
                          <p className="leading-tight">{c.name}</p>
                          {isBusiness && c.company_code && (
                            <p className="text-xs font-normal text-zinc-400">{c.company_code}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          isBusiness
                            ? "bg-blue-50 text-blue-700 ring-blue-200"
                            : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                        }`}>
                          {isBusiness ? <Building2 size={10} /> : <User size={10} />}
                          {isBusiness ? "Business" : "Individual"}
                        </span>
                        {isBusiness && c.sales_tax_exempt && (
                          <span className="inline-flex w-fit items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
                            Tax Exempt
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 text-zinc-600">
                      {c.phone && <p>{c.phone}</p>}
                      {c.email && <p className="text-xs text-zinc-400">{c.email}</p>}
                      {!c.phone && !c.email && <span className="text-zinc-300">—</span>}
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-[160px]">
                      {addressFull ? (
                        <div>
                          {c.address_street && <p className="truncate">{c.address_street}</p>}
                          {(c.address_city || c.address_state || c.address_zip) && (
                            <p className="text-zinc-400">
                              {[c.address_city, c.address_state].filter(Boolean).join(", ")}
                              {c.address_zip ? ` ${c.address_zip}` : ""}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>

                    {/* Tags */}
                    <td className="px-4 py-3">
                      {c.customer_type ? (
                        <div className="flex flex-wrap gap-1">
                          {c.customer_type.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                      {fmtDate(c.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count */}
      {!loading && filtered.length > 0 && (
        <p className="mt-2 text-right text-xs text-zinc-400">
          Showing {filtered.length} of {customers.length}
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <CustomerModal
          customer={editing}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
          onSaved={fetchCustomers}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete customer?</h3>
            <p className="mt-1 text-sm text-zinc-500">This action cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
