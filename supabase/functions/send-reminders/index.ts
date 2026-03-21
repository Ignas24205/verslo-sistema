// Supabase Edge Function — send-reminders
// Runs daily (cron: "0 8 * * *") and emails project reminders via Resend.
// Required env vars: RESEND_API_KEY, FROM_EMAIL (optional, defaults to onboarding@resend.dev)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  customer_name: string | null;
  op_status: string;
  fin_status: string;
  end_date: string | null;
  invoice_date: string | null;
}

type ReminderType = "end_soon" | "invoice_soon" | "overdue";

interface Reminder {
  project: Project;
  type: ReminderType;
  date: string | null;
  daysUntil: number;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function dayLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1)  return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${Math.abs(days)} days ago`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(reminders: Reminder[]): string {
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const endSoon     = reminders.filter((r) => r.type === "end_soon");
  const invoiceSoon = reminders.filter((r) => r.type === "invoice_soon");
  const overdueList = reminders.filter((r) => r.type === "overdue");

  function section(
    title: string,
    accentColor: string,
    bgColor: string,
    items: Reminder[],
    dateColumnLabel: string
  ): string {
    if (items.length === 0) return "";

    const rows = items
      .map(
        (r) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;vertical-align:top;">
            <div style="font-weight:600;color:#18181b;font-size:14px;">${r.project.name}</div>
            <div style="color:#71717a;font-size:13px;margin-top:2px;">${r.project.customer_name ?? "—"}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;white-space:nowrap;color:#52525b;font-size:14px;vertical-align:top;">
            ${fmtDate(r.date)}
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;white-space:nowrap;vertical-align:top;">
            <span style="color:${accentColor};font-weight:700;font-size:13px;">${dayLabel(r.daysUntil)}</span>
          </td>
        </tr>`
      )
      .join("");

    return `
      <div style="margin-bottom:28px;">
        <div style="margin-bottom:10px;">
          <span style="display:inline-block;background:${bgColor};color:${accentColor};border:1px solid ${accentColor}33;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">
            ${title} · ${items.length}
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;font-size:14px;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:8px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;font-weight:600;border-bottom:1px solid #e4e4e7;">
                Project · Client
              </th>
              <th style="padding:8px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;font-weight:600;border-bottom:1px solid #e4e4e7;">
                ${dateColumnLabel}
              </th>
              <th style="padding:8px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;font-weight:600;border-bottom:1px solid #e4e4e7;">
                When
              </th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Project Reminders</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:620px;margin:32px auto 48px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 1px 3px rgba(0,0,0,.06);">

    <!-- Header -->
    <div style="background:#18181b;padding:24px 28px 20px;">
      <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Sun Closets System</p>
      <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">Daily Reminders &nbsp;·&nbsp; ${todayStr}</p>
    </div>

    <!-- Summary banner -->
    <div style="background:#fafafa;padding:16px 28px;border-bottom:1px solid #e4e4e7;">
      <p style="margin:0;font-size:15px;color:#3f3f46;">
        You have
        <strong style="color:#18181b;">${reminders.length} project reminder${reminders.length !== 1 ? "s" : ""}</strong>
        that need attention today.
      </p>
    </div>

    <!-- Reminder sections -->
    <div style="padding:24px 28px 12px;">
      ${section("Deadline approaching", "#ca8a04", "#fefce8", endSoon, "End date")}
      ${section("Invoice due soon",    "#2563eb", "#eff6ff", invoiceSoon, "Invoice date")}
      ${section("Payment overdue",     "#dc2626", "#fef2f2", overdueList, "Invoice date")}
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:16px 28px;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
        Sent automatically by <strong>Sun Closets System</strong>.<br>
        To update your reminder email, visit <em>Settings → Email Reminders</em>.
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const supabaseUrl            = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey           = Deno.env.get("RESEND_API_KEY");
    const fromEmail              = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY env var is not set." }), { status: 500, headers });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ── 1. Read reminder_email from settings ──────────────────────────────
    const { data: settingRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "reminder_email")
      .maybeSingle();

    const recipientEmail = (settingRow?.value ?? "").trim();
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ message: "No reminder_email configured in Settings. Nothing sent." }),
        { status: 200, headers }
      );
    }

    // ── 2. Fetch projects (skip already Paid) ─────────────────────────────
    const { data: projects, error: projErr } = await supabase
      .from("v_projects_rollup")
      .select("id, name, customer_name, op_status, fin_status, end_date, invoice_date")
      .neq("fin_status", "Paid");

    if (projErr) throw new Error(projErr.message);

    // ── 3. Build reminders list ───────────────────────────────────────────
    const reminders: Reminder[] = [];

    for (const p of (projects ?? []) as Project[]) {
      // Deadline approaching (0–3 days, not finished)
      if (p.end_date && p.op_status !== "Finished") {
        const days = getDaysUntil(p.end_date);
        if (days >= 0 && days <= 3) {
          reminders.push({ project: p, type: "end_soon", date: p.end_date, daysUntil: days });
        }
      }

      // Invoice date approaching (0–3 days, not yet invoiced)
      if (p.invoice_date && p.fin_status === "Not invoiced") {
        const days = getDaysUntil(p.invoice_date);
        if (days >= 0 && days <= 3) {
          reminders.push({ project: p, type: "invoice_soon", date: p.invoice_date, daysUntil: days });
        }
      }

      // Payment overdue
      if (p.fin_status === "Overdue") {
        reminders.push({
          project: p,
          type: "overdue",
          date: p.invoice_date,
          daysUntil: p.invoice_date ? getDaysUntil(p.invoice_date) : -1,
        });
      }
    }

    if (reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders today — all projects are on track." }),
        { status: 200, headers }
      );
    }

    // ── 4. Send email via Resend ──────────────────────────────────────────
    const emailDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Sun Closets System <${fromEmail}>`,
        to: [recipientEmail],
        subject: `${reminders.length} project reminder${reminders.length !== 1 ? "s" : ""} — ${emailDate}`,
        html: buildEmailHtml(reminders),
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      throw new Error(`Resend API error (${resendRes.status}): ${errBody}`);
    }

    const result = await resendRes.json();

    return new Response(
      JSON.stringify({
        message: `Sent ${reminders.length} reminder(s) to ${recipientEmail}.`,
        resend_id: result.id,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("[send-reminders]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers }
    );
  }
});
