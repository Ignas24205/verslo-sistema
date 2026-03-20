"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ProjectModal, { type Project } from "./ProjectModal";

function calcMetrics(p: Project) {
  const revenue = p.work_revenue + p.material_revenue;
  const cost = p.material_cost + p.extra_costs;
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, profit, margin };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const opStatusStyles: Record<string, string> = {
  "In progress": "bg-yellow-50 text-yellow-700 ring-yellow-200",
  Finished: "bg-green-50 text-green-700 ring-green-200",
};

const finStatusStyles: Record<string, string> = {
  "Not invoiced": "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Invoiced: "bg-blue-50 text-blue-700 ring-blue-200",
  Paid: "bg-green-50 text-green-700 ring-green-200",
  Overdue: "bg-red-50 text-red-700 ring-red-200",
};

function Badge({ label, styles }: { label: string; styles: Record<string, string> }) {
  const cls = styles[label] ?? "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

export default function SalesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function fetchProjects() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*, customers(name)")
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProjects();

    const supabase = createClient();
    const channel = supabase
      .channel("projects-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Sales</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead>
              <tr className="bg-zinc-50">
                {["Name", "Client", "Status", "Financial Status", "Revenue", "Profit", "Margin %", "Invoice Date"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && projects.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">
                    No projects yet. Create your first one.
                  </td>
                </tr>
              )}
              {projects.map((p) => {
                const { revenue, profit, margin } = calcMetrics(p);
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/sales/${p.id}`)}
                    className="cursor-pointer hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {p.customers?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={p.op_status} styles={opStatusStyles} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={p.fin_status} styles={finStatusStyles} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-900">{fmt(revenue)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={profit >= 0 ? "text-green-700" : "text-red-600"}>
                        {fmt(profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={margin >= 0 ? "text-green-700" : "text-red-600"}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{fmtDate(p.invoice_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ProjectModal
          onClose={() => setShowModal(false)}
          onSaved={fetchProjects}
        />
      )}
    </>
  );
}
