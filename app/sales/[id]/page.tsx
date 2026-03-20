"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ProjectModal, { type Project } from "../ProjectModal";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  async function fetchProject() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*, customers(name)")
      .eq("id", id)
      .single();
    setProject(data as Project | null);
    setLoading(false);
  }

  useEffect(() => {
    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-400">
        Loading...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-sm text-zinc-500">Project not found.</p>
        <button
          onClick={() => router.push("/sales")}
          className="text-sm font-medium text-zinc-900 underline"
        >
          Back to Sales
        </button>
      </div>
    );
  }

  const revenue = project.work_revenue + project.material_revenue;
  const cost = project.material_cost + project.extra_costs;
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/sales")}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{project.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {project.customers?.name ?? "—"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>

      {/* Status badges */}
      <div className="mt-4 flex items-center gap-2">
        <Badge label={project.op_status} styles={opStatusStyles} />
        <Badge label={project.fin_status} styles={finStatusStyles} />
        <span className="text-xs text-zinc-400">{project.lead_source}</span>
      </div>

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Project details */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Project Details</h2>
          <InfoRow label="Client" value={project.customers?.name ?? "—"} />
          <InfoRow label="Lead source" value={project.lead_source} />
          <InfoRow label="Start date" value={fmtDate(project.start_date)} />
          <InfoRow label="End date" value={fmtDate(project.end_date)} />
          <InfoRow label="Planned invoice date" value={fmtDate(project.invoice_date)} />
        </div>

        {/* Financial summary */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Financials</h2>
          <InfoRow label="Work revenue" value={fmt(project.work_revenue)} />
          <InfoRow label="Material revenue" value={fmt(project.material_revenue)} />
          <InfoRow
            label="Revenue"
            value={
              <span className="font-semibold">{fmt(revenue)}</span>
            }
          />
          <InfoRow label="Material cost" value={fmt(project.material_cost)} />
          <InfoRow label="Extra costs" value={fmt(project.extra_costs)} />
          <InfoRow
            label="Profit"
            value={
              <span className={profit >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                {fmt(profit)}
              </span>
            }
          />
          <InfoRow
            label="Margin"
            value={
              <span className={margin >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                {margin.toFixed(1)}%
              </span>
            }
          />
        </div>
      </div>

      {/* Notes */}
      {project.notes && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Notes</h2>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{project.notes}</p>
        </div>
      )}

      {editOpen && (
        <ProjectModal
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={fetchProject}
        />
      )}
    </>
  );
}
