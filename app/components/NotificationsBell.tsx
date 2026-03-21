"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, AlertTriangle, CalendarClock, CreditCard, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = "end_soon" | "invoice_soon" | "overdue" | "end_missed";

type Notification = {
  id: string;           // "{project_id}_{type}" — stable key
  project_id: string;
  project_name: string;
  customer_name: string | null;
  type: NotifType;
  date: string | null;
  daysUntil: number;    // negative = already past
};

type ProjectRaw = {
  id: string;
  name: string;
  customer_name: string | null;
  op_status: string;
  fin_status: string;
  end_date: string | null;
  invoice_date: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_KEY = "notif_read_ids";

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
}

function buildNotifications(projects: ProjectRaw[]): Notification[] {
  const notifs: Notification[] = [];

  for (const p of projects) {
    // 1. End date approaching (0–3 days, not yet finished)
    if (p.end_date && p.op_status !== "Finished") {
      const days = getDaysUntil(p.end_date);
      if (days >= 0 && days <= 3) {
        notifs.push({
          id: `${p.id}_end_soon`,
          project_id: p.id,
          project_name: p.name,
          customer_name: p.customer_name,
          type: "end_soon",
          date: p.end_date,
          daysUntil: days,
        });
      }
      // 2. Deadline already missed (past, not finished)
      if (days < 0) {
        notifs.push({
          id: `${p.id}_end_missed`,
          project_id: p.id,
          project_name: p.name,
          customer_name: p.customer_name,
          type: "end_missed",
          date: p.end_date,
          daysUntil: days,
        });
      }
    }

    // 3. Invoice date approaching (0–3 days, not yet invoiced)
    if (p.invoice_date && p.fin_status === "Not invoiced") {
      const days = getDaysUntil(p.invoice_date);
      if (days >= 0 && days <= 3) {
        notifs.push({
          id: `${p.id}_invoice_soon`,
          project_id: p.id,
          project_name: p.name,
          customer_name: p.customer_name,
          type: "invoice_soon",
          date: p.invoice_date,
          daysUntil: days,
        });
      }
    }

    // 4. Payment overdue
    if (p.fin_status === "Overdue") {
      notifs.push({
        id: `${p.id}_overdue`,
        project_id: p.id,
        project_name: p.name,
        customer_name: p.customer_name,
        type: "overdue",
        date: p.invoice_date,
        daysUntil: p.invoice_date ? getDaysUntil(p.invoice_date) : -1,
      });
    }
  }

  // Sort: most urgent first (smallest daysUntil)
  notifs.sort((a, b) => a.daysUntil - b.daysUntil);
  return notifs;
}

// ─── Notification item config ─────────────────────────────────────────────────

const TYPE_META: Record<NotifType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  end_soon: {
    label: "Deadline approaching",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  end_missed: {
    label: "Deadline missed",
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  invoice_soon: {
    label: "Invoice due soon",
    icon: CalendarClock,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  overdue: {
    label: "Payment overdue",
    icon: CreditCard,
    color: "text-red-600",
    bg: "bg-red-50",
  },
};

function dayLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1)  return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${Math.abs(days)} days ago`;
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [notifs, setNotifs]       = useState<Notification[]>([]);
  const [readIds, setReadIds]     = useState<Set<string>>(new Set());
  const containerRef              = useRef<HTMLDivElement>(null);

  // Load read IDs from localStorage (client-only)
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  // Fetch projects and build notifications
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_projects_rollup")
      .select("id, name, customer_name, op_status, fin_status, end_date, invoice_date");
    if (data) setNotifs(buildNotifications(data as ProjectRaw[]));
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 10 minutes
    const iv = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const unreadCount = notifs.filter((n) => !readIds.has(n.id)).length;

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }

  function markAllRead() {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifs.forEach((n) => next.add(n.id));
      saveReadIds(next);
      return next;
    });
  }

  function handleClick(n: Notification) {
    markRead(n.id);
    setOpen(false);
    router.push(`/sales/${n.project_id}`);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed left-56 top-0 z-50 flex h-screen w-80 flex-col border-l border-zinc-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Bell size={28} className="text-zinc-200" />
                <p className="text-sm font-medium text-zinc-400">All clear!</p>
                <p className="text-xs text-zinc-300">No upcoming deadlines or overdue items.</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {notifs.map((n) => {
                  const meta   = TYPE_META[n.type];
                  const Icon   = meta.icon;
                  const isRead = readIds.has(n.id);

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-zinc-50 ${
                          isRead ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                            <Icon size={13} className={meta.color} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                                {meta.label}
                              </p>
                              {!isRead && (
                                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                              )}
                            </div>
                            <p className="mt-0.5 text-sm font-medium text-zinc-900 leading-tight truncate">
                              {n.project_name}
                            </p>
                            {n.customer_name && (
                              <p className="text-xs text-zinc-400">{n.customer_name}</p>
                            )}
                            {n.date && (
                              <p className={`mt-1 text-xs font-medium ${meta.color}`}>
                                {fmtDate(n.date)} — {dayLabel(n.daysUntil)}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="border-t border-zinc-100 px-4 py-2.5">
              <p className="text-[10px] text-zinc-300">
                {notifs.length} alert{notifs.length !== 1 ? "s" : ""} · Click to go to project
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
