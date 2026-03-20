"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import CustomerModal, { type Customer } from "./CustomerModal";

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

  async function fetchCustomers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    setCustomers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchCustomers();

    const supabase = createClient();
    const channel = supabase
      .channel("customers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        () => fetchCustomers()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
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

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead>
              <tr className="bg-zinc-50">
                {["Name", "Customer Type", "Phone", "Email", "Created", ""].map((col) => (
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
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                    No customers yet. Add your first one.
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {c.customer_type ? (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {c.customer_type}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{fmtDate(c.created_at)}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <CustomerModal
          customer={editing}
          onClose={() => setModalOpen(false)}
          onSaved={fetchCustomers}
        />
      )}

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
