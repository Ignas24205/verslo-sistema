"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalProject = {
  id: string;
  name: string;
  customer_name: string | null;
  op_status: string;
  fin_status: string;
  start_date: string | null;
  end_date: string | null;
  invoice_date: string | null;
};

type Bar = {
  project: CalProject;
  startCol: number; // 0–6 within the week
  endCol: number;
  lane: number;
};

// ─── Date utils ───────────────────────────────────────────────────────────────

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sod(d: Date): Date {
  // start of day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Monday = 0, Sunday = 6 */
function dow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const d = parseDate(s)!;
  const today = sod(new Date());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

// ─── Calendar grid builders ───────────────────────────────────────────────────

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = dow(first);
  const last = new Date(year, month + 1, 0);
  const rows = Math.ceil((startOffset + last.getDate()) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(first, i - startOffset));
}

function weekDays(anchor: Date): Date[] {
  const offset = dow(anchor);
  const mon = addDays(anchor, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

// ─── Project / bar logic ──────────────────────────────────────────────────────

function overlaps(p: CalProject, rangeStart: Date, rangeEnd: Date): boolean {
  const s = parseDate(p.start_date) ?? parseDate(p.end_date);
  const e = parseDate(p.end_date) ?? parseDate(p.start_date);
  if (!s || !e) return false;
  return s <= rangeEnd && e >= rangeStart;
}

function barsForWeek(projects: CalProject[], week: Date[]): Bar[] {
  const ws = week[0];
  const we = week[6];

  const relevant = projects
    .filter(p => overlaps(p, ws, we))
    .sort((a, b) => {
      const as = parseDate(a.start_date) ?? parseDate(a.end_date);
      const bs = parseDate(b.start_date) ?? parseDate(b.end_date);
      if (!as || !bs) return 0;
      return as.getTime() - bs.getTime();
    });

  const bars: Bar[] = [];

  for (const p of relevant) {
    const pStart = parseDate(p.start_date) ?? parseDate(p.end_date)!;
    const pEnd = parseDate(p.end_date) ?? parseDate(p.start_date)!;

    const clStart = pStart < ws ? ws : pStart;
    const clEnd = pEnd > we ? we : pEnd;

    let sc = week.findIndex(d => sameDay(d, clStart));
    let ec = week.findIndex(d => sameDay(d, clEnd));
    if (sc === -1) sc = 0;
    if (ec === -1) ec = 6;

    // Assign lowest free lane
    let lane = 0;
    while (bars.some(b => b.lane === lane && !(b.endCol < sc || b.startCol > ec))) {
      lane++;
    }

    bars.push({ project: p, startCol: sc, endCol: ec, lane });
  }

  return bars;
}

function isUrgent(p: CalProject): boolean {
  const ed = daysUntil(p.end_date);
  const id = daysUntil(p.invoice_date);
  const endAlert = ed !== null && ed >= 0 && ed <= 3 && p.op_status !== "Finished";
  const invAlert = id !== null && id >= 0 && id <= 3 && !["Paid", "Invoiced"].includes(p.fin_status);
  return endAlert || invAlert;
}

function barStyle(p: CalProject): string {
  if (isUrgent(p))          return "bg-orange-100 text-orange-800 border-l-2 border-orange-400 hover:bg-orange-200";
  if (p.op_status === "Finished") return "bg-green-100  text-green-800  border-l-2 border-green-500  hover:bg-green-200";
  return                           "bg-blue-100   text-blue-800   border-l-2 border-blue-400   hover:bg-blue-200";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANE_H    = 22;  // px per project lane
const DAY_NUM_H = 26;  // px for the day-number header inside each cell
const CELL_PAD  = 6;   // extra bottom padding
const MIN_ROW_H = 64;  // minimum row height (month)
const MIN_WEEK_H = 140; // minimum row height (week)

const DAY_ABBR  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── WeekRow ──────────────────────────────────────────────────────────────────

function WeekRow({
  week,
  bars,
  today,
  currentMonth,
  isWeekView,
  onProject,
}: {
  week: Date[];
  bars: Bar[];
  today: Date;
  currentMonth: number;
  isWeekView: boolean;
  onProject: (id: string) => void;
}) {
  const maxLane = bars.length > 0 ? Math.max(...bars.map(b => b.lane)) : -1;
  const rowH = Math.max(
    DAY_NUM_H + (maxLane + 1) * LANE_H + CELL_PAD,
    isWeekView ? MIN_WEEK_H : MIN_ROW_H
  );

  return (
    <div className="relative border-b border-zinc-100 last:border-b-0" style={{ height: rowH }}>
      {/* Day cells (background + day number) */}
      <div className="grid grid-cols-7 h-full pointer-events-none">
        {week.map(d => {
          const isToday = sameDay(d, today);
          const otherMonth = d.getMonth() !== currentMonth && !isWeekView;
          return (
            <div
              key={dateKey(d)}
              className={`border-r border-zinc-100 last:border-r-0 ${otherMonth ? "bg-zinc-50/70" : ""}`}
            >
              <div className="px-1.5 pt-1">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium select-none ${
                    isToday
                      ? "bg-zinc-900 text-white"
                      : otherMonth
                      ? "text-zinc-300"
                      : "text-zinc-500"
                  }`}
                >
                  {d.getDate()}
                </span>
                {isWeekView && (
                  <span className="ml-1 text-[10px] text-zinc-400">
                    {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project bars (absolutely positioned over the grid) */}
      {bars.map((bar, i) => {
        const urgent = isUrgent(bar.project);
        const leftPct  = (bar.startCol / 7) * 100;
        const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
        const top = DAY_NUM_H + bar.lane * LANE_H;

        return (
          <button
            key={`${bar.project.id}-${i}`}
            onClick={() => onProject(bar.project.id)}
            className={`absolute rounded px-1.5 text-left text-[11px] font-medium truncate transition-opacity ${barStyle(bar.project)}`}
            style={{
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              top,
              height: LANE_H - 3,
              lineHeight: `${LANE_H - 3}px`,
            }}
            title={[
              bar.project.name,
              bar.project.customer_name,
              bar.project.op_status,
              urgent ? "⚠ deadline soon" : null,
            ].filter(Boolean).join(" · ")}
          >
            {urgent ? "⚠ " : ""}{bar.project.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const today = sod(new Date());

  const [projects, setProjects] = useState<CalProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"month" | "week">("month");
  const [anchor, setAnchor]     = useState(() => sod(new Date()));

  async function fetchProjects() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, name, op_status, fin_status, start_date, end_date, invoice_date, customers(name)")
      .order("start_date", { ascending: true });

    setProjects(
      ((data ?? []) as unknown as (Omit<CalProject, "customer_name"> & {
        customers: { name: string } | null;
      })[]).map(p => ({ ...p, customer_name: p.customers?.name ?? null }))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchProjects();
    const supabase = createClient();
    const ch = supabase
      .channel("calendar-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation
  function prev() {
    setAnchor(a =>
      view === "month" ? new Date(a.getFullYear(), a.getMonth() - 1, 1) : addDays(a, -7)
    );
  }
  function next() {
    setAnchor(a =>
      view === "month" ? new Date(a.getFullYear(), a.getMonth() + 1, 1) : addDays(a, 7)
    );
  }
  function goToday() { setAnchor(sod(new Date())); }

  // Grid days
  const days = useMemo(
    () => view === "month" ? monthGrid(anchor.getFullYear(), anchor.getMonth()) : weekDays(anchor),
    [view, anchor]
  );

  // Split into week arrays
  const weeks = useMemo<Date[][]>(() => {
    if (view === "week") return [days];
    const w: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return w;
  }, [days, view]);

  // Pre-compute bars per week
  const allBars = useMemo(
    () => weeks.map(w => barsForWeek(projects, w)),
    [weeks, projects]
  );

  // Reminders: end_date or invoice_date within 0–3 days
  const reminders = useMemo(() =>
    projects.filter(p => {
      const ed = daysUntil(p.end_date);
      const id = daysUntil(p.invoice_date);
      const endAlert = ed !== null && ed >= 0 && ed <= 3 && p.op_status !== "Finished";
      const invAlert = id !== null && id >= 0 && id <= 3 && !["Paid", "Invoiced"].includes(p.fin_status);
      return endAlert || invAlert;
    }),
    [projects]
  );

  // Title
  const title = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const wd = weekDays(anchor);
    const s = wd[0]; const e = wd[6];
    const sLabel = `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0, 3)}`;
    const eLabel = `${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
    return `${sLabel} – ${eLabel}`;
  }, [view, anchor]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Calendar</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Projects by start and end date</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month / Week toggle */}
          <div className="flex overflow-hidden rounded-md border border-zinc-200 bg-white text-sm">
            {(["month", "week"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                  view === v ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Prev / Today / Next */}
          <button
            onClick={prev}
            className="rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Today
          </button>
          <button
            onClick={next}
            className="rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Period title */}
      <p className="mt-2 text-sm font-semibold text-zinc-700">{title}</p>

      {/* Reminders panel */}
      {reminders.length > 0 && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={13} className="text-orange-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
              Upcoming deadlines — within 3 days
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {reminders.map(p => {
              const ed = daysUntil(p.end_date);
              const id = daysUntil(p.invoice_date);
              const endAlert = ed !== null && ed >= 0 && ed <= 3 && p.op_status !== "Finished";
              const invAlert = id !== null && id >= 0 && id <= 3 && !["Paid", "Invoiced"].includes(p.fin_status);
              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/sales/${p.id}`)}
                  className="flex items-center gap-1.5 rounded-md border border-orange-200 bg-white px-2.5 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100"
                >
                  {p.name}
                  {endAlert && ed !== null && (
                    <span className="text-orange-500">
                      · end {ed === 0 ? "today" : `in ${ed}d`}
                    </span>
                  )}
                  {invAlert && id !== null && (
                    <span className="text-orange-500">
                      · invoice {id === 0 ? "today" : `in ${id}d`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {/* Day name header */}
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {DAY_ABBR.map(name => (
            <div
              key={name}
              className="border-r border-zinc-200 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500 last:border-r-0"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-400">Loading...</div>
        ) : (
          weeks.map((week, wi) => (
            <WeekRow
              key={dateKey(week[0])}
              week={week}
              bars={allBars[wi]}
              today={today}
              currentMonth={anchor.getMonth()}
              isWeekView={view === "week"}
              onProject={id => router.push(`/sales/${id}`)}
            />
          ))
        )}
      </div>

      {/* Legend + stats */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-5 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-l-2 border-blue-400 bg-blue-100" />
            In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-l-2 border-green-500 bg-green-100" />
            Finished
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-l-2 border-orange-400 bg-orange-100" />
            Deadline within 3 days
          </span>
        </div>
        {!loading && (
          <span className="text-xs text-zinc-400">
            {projects.filter(p => p.start_date || p.end_date).length} projects on calendar
          </span>
        )}
      </div>
    </>
  );
}
