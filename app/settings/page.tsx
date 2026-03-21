"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Save,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Terminal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";
type TestState = "idle" | "sending" | "sent" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? "";
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

// ─── Setup steps component ────────────────────────────────────────────────────

function SetupSteps() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-zinc-50"
      >
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-900">Deployment &amp; Cron Setup</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
            one-time
          </span>
        </div>
        {open ? <ChevronDown size={15} className="text-zinc-400" /> : <ChevronRight size={15} className="text-zinc-400" />}
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-5 text-sm text-zinc-700">

          {/* Step 1 */}
          <Step n={1} title="Create the settings table in Supabase">
            <p className="mb-2 text-zinc-500">Run in <strong>Supabase → SQL Editor</strong>:</p>
            <Code>{`create table if not exists settings (
  key   text primary key,
  value text
);
alter table settings enable row level security;
create policy "auth users" on settings
  for all to authenticated using (true) with check (true);

-- seed default keys
insert into settings (key, value)
values ('reminder_email', '')
on conflict (key) do nothing;`}</Code>
          </Step>

          {/* Step 2 */}
          <Step n={2} title="Get a free Resend API key">
            <p className="text-zinc-500">
              Sign up at <strong>resend.com</strong> (free — 3 000 emails/month). Copy your API key from the dashboard.
              Optionally verify a sending domain; for testing you can use <code className="bg-zinc-100 px-1 rounded text-xs">onboarding@resend.dev</code>.
            </p>
          </Step>

          {/* Step 3 */}
          <Step n={3} title="Add secrets to Supabase Edge Functions">
            <p className="mb-2 text-zinc-500">In <strong>Supabase → Edge Functions → Secrets</strong> add:</p>
            <Code>{`RESEND_API_KEY   =  re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL       =  reminders@yourdomain.com`}</Code>
            <p className="mt-2 text-zinc-400 text-xs">
              <code className="bg-zinc-100 px-1 rounded">FROM_EMAIL</code> is optional — omit to use <em>onboarding@resend.dev</em> (Resend sandbox).
            </p>
          </Step>

          {/* Step 4 */}
          <Step n={4} title="Deploy the Edge Function">
            <p className="mb-2 text-zinc-500">Run from the project root:</p>
            <Code>{`npx supabase functions deploy send-reminders`}</Code>
          </Step>

          {/* Step 5 */}
          <Step n={5} title="Schedule daily runs with pg_cron">
            <p className="mb-2 text-zinc-500">
              In <strong>Supabase → SQL Editor</strong>, enable extensions and create the cron job.
              Replace <code className="bg-zinc-100 px-1 rounded text-xs">&lt;project-ref&gt;</code> and <code className="bg-zinc-100 px-1 rounded text-xs">&lt;anon-key&gt;</code>
              with your values from <em>Project Settings → API</em>:
            </p>
            <Code>{`-- enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- schedule: every day at 08:00 UTC
select cron.schedule(
  'daily-reminders',
  '0 8 * * *',
  $$
    select net.http_post(
      url     := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <anon-key>'
      )
    )
  $$
);`}</Code>
            <p className="mt-2 text-zinc-400 text-xs">
              Change <code className="bg-zinc-100 px-1 rounded">0 8 * * *</code> to any time you prefer (cron is UTC).
            </p>
          </Step>

        </div>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 mb-1.5">{title}</p>
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-zinc-950 px-4 py-3 text-xs leading-relaxed text-zinc-200 whitespace-pre">
      {children}
    </pre>
  );
}

// ─── Email Reminders section ──────────────────────────────────────────────────

function EmailReminders() {
  const [email,     setEmail]     = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg,   setTestMsg]   = useState("");
  const [error,     setError]     = useState("");

  useEffect(() => {
    getSetting("reminder_email").then(setEmail).catch(() => {});
  }, []);

  async function handleSave() {
    setError("");
    setSaveState("saving");
    try {
      await upsertSetting("reminder_email", email.trim());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      setError((e as Error).message);
      setSaveState("error");
    }
  }

  async function handleTestSend() {
    setTestMsg("");
    setTestState("sending");
    try {
      const supabase = createClient();
      const { data, error: fnErr } = await supabase.functions.invoke("send-reminders");
      if (fnErr) throw new Error(fnErr.message);
      const msg = (data as { message?: string; error?: string })?.message
        ?? (data as { error?: string })?.error
        ?? "Done.";
      setTestMsg(msg);
      setTestState("sent");
      setTimeout(() => setTestState("idle"), 8000);
    } catch (e) {
      setTestMsg((e as Error).message);
      setTestState("error");
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail size={16} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-zinc-900">Email Reminders</h2>
      </div>

      <p className="text-sm text-zinc-500 mb-4">
        The <code className="bg-zinc-100 px-1 rounded text-xs">send-reminders</code> Edge Function runs daily at 8:00 AM UTC and emails
        alerts for projects with an approaching deadline, upcoming invoice date, or overdue payment.
      </p>

      {/* Email input + Save */}
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Reminder email address
      </label>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSaveState("idle"); }}
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            saveState === "saved"
              ? "bg-green-600 text-white"
              : "bg-zinc-900 text-white hover:bg-zinc-700"
          }`}
        >
          {saveState === "saving" ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : saveState === "saved" ? (
            <><CheckCircle2 size={14} /> Saved</>
          ) : (
            <><Save size={14} /> Save</>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {/* Divider */}
      <div className="my-5 border-t border-zinc-100" />

      {/* Test send */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900">Send test email now</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Triggers the Edge Function immediately. Sends an email only if there are active reminders.
          </p>
        </div>
        <button
          onClick={handleTestSend}
          disabled={testState === "sending" || !email.trim()}
          className={`shrink-0 flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            testState === "sent"
              ? "border-green-200 bg-green-50 text-green-700"
              : testState === "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {testState === "sending" ? (
            <><Loader2 size={14} className="animate-spin" /> Sending…</>
          ) : testState === "sent" ? (
            <><CheckCircle2 size={14} /> Sent</>
          ) : testState === "error" ? (
            <><AlertCircle size={14} /> Error</>
          ) : (
            <><Send size={14} /> Send test</>
          )}
        </button>
      </div>

      {testMsg && (
        <p className={`mt-2 rounded-md px-3 py-2 text-xs ${
          testState === "error" ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-600"
        }`}>
          {testMsg}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-0.5 text-sm text-zinc-500">System configuration and integrations</p>
      </div>

      <div className="mt-6 flex flex-col gap-4 max-w-2xl">
        <EmailReminders />
        <SetupSteps />
      </div>
    </>
  );
}
