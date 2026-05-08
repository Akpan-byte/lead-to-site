'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Lead, LeadProgress, SSEEvent, PipelineResult } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  idle:     { label: 'Idle',      color: 'text-text-muted', dot: 'bg-border' },
  queued:   { label: 'Queued',    color: 'text-info',       dot: 'bg-info pulse' },
  scraping: { label: 'Scraping',  color: 'text-warning',   dot: 'bg-warning pulse' },
  generating:{ label: 'Generating',color: 'text-accent',    dot: 'bg-accent pulse' },
  deploying: { label: 'Deploying', color: 'text-info',      dot: 'bg-info pulse' },
  sending:  { label: 'Sending',   color: 'text-purple-400',dot: 'bg-purple-400 pulse' },
  done:     { label: 'Done',      color: 'text-success',    dot: 'bg-success' },
  error:    { label: 'Error',     color: 'text-error',      dot: 'bg-error' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['idle'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── Send Status Badge ────────────────────────────────────────────────────────

const SEND_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sent:          { label: 'Sent',            color: 'text-success', bg: 'bg-success/10' },
  failed:        { label: 'Send Failed',      color: 'text-error',   bg: 'bg-error/10' },
  pending_gmail: { label: 'Gmail Not Set',    color: 'text-warning', bg: 'bg-warning/10' },
};

function SendStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cfg = SEND_STATUS_CONFIG[status] || SEND_STATUS_CONFIG['pending_gmail'];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

// ─── API Client ───────────────────────────────────────────────────────────────

async function uploadCSV(file: File): Promise<{ run_id: string; leads_count: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

async function getRunStatus(runId: string) {
  const res = await fetch(`/api/pipeline/${runId}/status`);
  if (!res.ok) throw new Error('Failed to get status');
  return res.json();
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ open, onClose, onSave, settings }: {
  open: boolean; onClose: () => void;
  onSave: (s: AppSettings) => void;
  settings: AppSettings;
}) {
  const [v, setV] = useState(settings.vercelToken || settings.vercel_token || '');
  const [d, setD] = useState(settings.deepseekKey || settings.deepseek_key || '');
  const [g, setG] = useState(settings.groqKey || settings.groq_key || '');
  const [gm, setGm] = useState(settings.gmailEmail || settings.gmail_email || '');
  const [gp, setGp] = useState(settings.gmailAppPassword || settings.gmail_app_password || '');

  // Sync when settings change
  useEffect(() => {
    setV(settings.vercelToken || settings.vercel_token || '');
    setD(settings.deepseekKey || settings.deepseek_key || '');
    setG(settings.groqKey || settings.groq_key || '');
    setGm(settings.gmailEmail || settings.gmail_email || '');
    setGp(settings.gmailAppPassword || settings.gmail_app_password || '');
  }, [settings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">API Settings</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          {/* Vercel */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Vercel API Token</label>
            <input type="password" value={v} onChange={e => setV(e.target.value)}
              placeholder="tok_xxxxxxxxxxxx"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-text-muted mt-1">From vercel.com/account/tokens — needs deploy permissions</p>
          </div>

          {/* Groq */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Groq API Key</label>
            <input type="password" value={g} onChange={e => setG(e.target.value)}
              placeholder="gsk_••••••"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-text-muted mt-1">Free at groq.com — uses Llama 3.3 70B for smarter emails</p>
          </div>

          {/* DeepSeek */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">DeepSeek API Key</label>
            <input type="password" value={d} onChange={e => setD(e.target.value)}
              placeholder="••••••"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-text-muted mt-1">Optional — fallback if Groq fails</p>
          </div>

          {/* Gmail */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Email Sending (Gmail Placeholder)</p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-text-muted mb-1">Your Gmail Address</label>
              <input type="email" value={gm} onChange={e => setGm(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-text-muted mb-1">Gmail App Password</label>
              <input type="password" value={gp} onChange={e => setGp(e.target.value)}
                placeholder="16-char app password"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Get it at{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline">
                  myaccount.google.com/apppasswords
                </a>
                {' '}(select "Other" app, copy the 16-char password)
              </p>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p className="text-[11px] text-purple-400">
                <strong>Gmail is the placeholder.</strong> Emails go to YOUR Gmail first so you can see exactly what they'll look like.
                Smartlead integration coming next.
              </p>
            </div>
          </div>

          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="text-[11px] text-text-muted">Tokens stored server-side in /tmp. Never sent to third parties.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-surface-2 transition-colors">
            Cancel
          </button>
          <button onClick={() => { onSave({ vercelToken: v, deepseekKey: d, groqKey: g, gmailEmail: gm, gmailAppPassword: gp }); onClose(); }}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AppSettings type ─────────────────────────────────────────────────────────

interface AppSettings {
  vercelToken?: string; vercel_token?: string;
  deepseekKey?: string; deepseek_key?: string;
  groqKey?: string; groq_key?: string;
  gmailEmail?: string; gmail_email?: string;
  gmailAppPassword?: string; gmail_app_password?: string;
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.endsWith('.csv')) { alert('Please upload a .csv file'); return; }
    onFile(file);
  }, [onFile]);

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer',
        dragging ? 'drop-active border-accent' : 'border-border hover:border-text-muted',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => handle(e.target.files)} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-2xl">📄</div>
        <div>
          <p className="text-sm font-medium text-text">{dragging ? 'Drop your CSV here' : 'Drop CSV or click to browse'}</p>
          <p className="text-xs text-text-muted mt-1">Required: company_name, website_url, email</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step Bar ────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: string }) {
  const steps = ['scraping', 'generating', 'deploying', 'sending'];
  const current = steps.indexOf(step);
  return (
    <div className="flex gap-1 mt-1">
      {steps.map((s, i) => (
        <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors', i <= current ? 'bg-accent' : 'bg-border')} />
      ))}
    </div>
  );
}

// ─── Email Preview Modal ──────────────────────────────────────────────────────

function EmailPreviewModal({ open, onClose, email, company, vercelUrl }: {
  open: boolean; onClose: () => void;
  email: { subject?: string; body?: string };
  company: string; vercelUrl?: string;
}) {
  if (!open) return null;

  const subject = email.subject || '(no subject)';
  const body = email.body || '(no body)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-sm">Email Preview</h3>
            <p className="text-xs text-text-muted mt-0.5">{company}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Subject */}
          <div>
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm font-medium text-text bg-surface-2 rounded-lg px-3 py-2">{subject}</p>
          </div>
          {/* Body */}
          <div>
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Body</p>
            <div className="bg-surface-2 rounded-lg px-3 py-3 whitespace-pre-wrap text-sm text-text leading-relaxed font-mono">{body}</div>
          </div>
          {/* Links */}
          <div className="flex gap-2 flex-wrap">
            {vercelUrl && (
              <a href={vercelUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors">
                View Site → {vercelUrl}
              </a>
            )}
            <button onClick={() => {
              const text = `Subject: ${subject}\n\n${body}`;
              navigator.clipboard.writeText(text).catch(() => {});
              alert('Copied!');
            }}
              className="px-3 py-1.5 rounded-lg bg-surface-2 text-text-muted text-xs font-medium hover:bg-border transition-colors">
              Copy Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Stats ──────────────────────────────────────────────────────────

function AnalyticsCards({ results, leads }: {
  results: PipelineResult[];
  leads: Lead[];
}) {
  const total = results.length;
  const deployed = results.filter(r => r.status === 'success' && r.final_url).length;
  const sent = results.filter(r => r.send_status === 'sent').length;
  const failed = results.filter(r => r.status === 'error').length;
  const pendingGmail = results.filter(r => r.send_status === 'pending_gmail').length;
  const sendFailed = results.filter(r => r.send_status === 'failed').length;
  const scraped = results.filter(r => r.steps?.scrape?.status === 'ok').length;
  const skippedScrape = results.filter(r => r.steps?.scrape?.status === 'skipped').length;

  const cards = [
    { label: 'Total Leads', value: total, icon: '👥', color: 'text-text' },
    { label: 'Sites Deployed', value: deployed, icon: '🌐', color: 'text-success' },
    { label: 'Emails Sent', value: sent, icon: '✉️', color: 'text-purple-400' },
    { label: 'Pending Gmail', value: pendingGmail, icon: '⏳', color: 'text-warning' },
    { label: 'Send Errors', value: sendFailed, icon: '⚠️', color: 'text-error' },
    { label: 'Pipeline Errors', value: failed, icon: '❌', color: 'text-error' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-surface border border-border rounded-xl p-3">
          <p className="text-[11px] text-text-muted mb-1">{c.label}</p>
          <p className={cn('text-2xl font-bold', c.color)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Results Row (expanded) ───────────────────────────────────────────────────

function ResultRow({ result, leads }: {
  result: PipelineResult;
  leads: Lead[];
}) {
  const [expanded, setExpanded] = useState(false);
  const lead = leads.find(l => l.id === result.lead_id || l.email === result.lead_id || l.company_name === result.company_name);
  const success = result.status === 'success';
  const scraped = result.steps?.scrape?.status === 'ok';
  const genOk = result.steps?.generate_html?.status === 'ok';

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2/50 transition-colors">
        {/* Status icon */}
        <span className={cn(
          'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5',
          success ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
        )}>
          {success ? '✓' : '✗'}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text">{result.company_name}</p>
            <SendStatusBadge status={result.send_status} />
            {success && result.final_url && (
              <a href={result.final_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2 py-0.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors shrink-0">
                🌐 {result.final_url.replace('https://', '')}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
            {lead?.email && <span>✉ {lead.email}</span>}
            {lead?.website_url && (
              <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                ↗ {lead.website_url.replace('https://', '')}
              </a>
            )}
            <span className={scraped ? 'text-success' : 'text-text-muted'}>
              {scraped ? '✓ Scraped' : skippedScrape(lead) ? '⊘ CSV data' : '—'}
            </span>
            <span className={genOk ? 'text-success' : 'text-error'}>
              {genOk ? '✓ Generated' : '✗ Failed'}
            </span>
          </div>
          {result.send_status === 'failed' && result.send_error && (
            <p className="text-[11px] text-error mt-1">Send error: {result.send_error}</p>
          )}
          {result.status === 'error' && result.error && (
            <p className="text-[11px] text-error mt-1">Error: {result.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {(result.email_subject || result.email_body) && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-medium">
              {expanded ? '▲ Hide Email' : '📧 View Email'}
            </button>
          )}
          <span className="text-[11px] text-text-muted">
            {result.html_size ? `${(result.html_size / 1024).toFixed(0)}KB` : ''}
          </span>
        </div>
      </div>

      {/* Expanded email preview */}
      {expanded && (
        <div className="px-5 pb-3 pl-14">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm font-medium mb-2">{result.email_subject || '(no subject)'}</p>
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Body</p>
            <p className="text-sm whitespace-pre-wrap text-text-muted leading-relaxed font-mono text-[12px]">{result.email_body || '(no body)'}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                const text = `Subject: ${result.email_subject || ''}\n\n${result.email_body || ''}`;
                navigator.clipboard.writeText(text).catch(() => {});
                alert('Email copied!');
              }}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted hover:bg-border transition-colors">
                Copy Email
              </button>
              {result.final_url && (
                <a href={result.final_url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors">
                  Open Site →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function skippedScrape(lead?: Lead) {
  if (!lead) return false;
  const skip = String(lead.skip_scrape || '').toLowerCase().trim();
  const score = ['services', 'tagline', 'about_text', 'description', 'industry', 'title']
    .filter(f => lead[f as keyof Lead]?.toString().trim()).length;
  return skip === 'true' || skip === '1' || skip === 'yes' || score >= 3;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(results: PipelineResult[], leads: Lead[]) {
  const headers = ['company_name', 'email', 'website_url', 'final_url', 'status', 'send_status', 'email_subject', 'email_body', 'error'];

  const rows = results.map(r => {
    const lead = leads.find(l => l.id === r.lead_id || l.email === r.lead_id || l.company_name === r.company_name);
    return [
      r.company_name,
      lead?.email || r.lead_id,
      lead?.website_url || '',
      r.final_url || '',
      r.status,
      r.send_status || '',
      (r.email_subject || '').replace(/"/g, '""'),
      (r.email_body || '').replace(/"/g, '""'),
      r.error || r.send_error || '',
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lead-to-site-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [runId, setRunId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadProgress, setLeadProgress] = useState<Record<string, LeadProgress>>({});
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<PipelineResult[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({});
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d)).catch(() => {});
  }, []);

  // Poll for status when runId exists
  useEffect(() => {
    if (!runId) return;
    const poll = setInterval(async () => {
      try {
        const data = await getRunStatus(runId);
        setPipelineStatus(data.status);
        if (data.lead_progress) setLeadProgress(data.lead_progress);
        if (data.results?.length) setResults(data.results);
        if (data.leads?.length && leads.length === 0) setLeads(data.leads);
      } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, [runId]);

  async function handleFile(file: File) {
    setError(null);
    try {
      const { run_id } = await uploadCSV(file);
      setRunId(run_id);
      setUploadedFileName(file.name);
      setLeadProgress({});
      setResults([]);
      setPipelineStatus('idle');

      const data = await getRunStatus(run_id);
      setLeads(data.leads || []);
      setLeadProgress(data.lead_progress || {});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Modal endpoint - direct call from browser
  const MODAL_BATCH_URL = 'https://theakpanobong--lead-to-site-process-batch-endpoint.modal.run';

  async function startPipeline() {
    if (!runId || leads.length === 0) return;
    setError(null);
    setPipelineStatus('running');
    setResults([]);

    // Reset lead progress
    setLeadProgress(prev => {
      const next: Record<string, LeadProgress> = {};
      for (const [id, lp] of Object.entries(prev)) {
        next[id] = { ...lp, status: 'queued' };
      }
      return next;
    });

    // Call Modal directly from browser - no filesystem involved
    try {
      const res = await fetch(MODAL_BATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });

      if (!res.ok) {
        throw new Error(`Modal error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const results = data.results || [];

      // Update lead progress with results
      const newProgress: Record<string, LeadProgress> = {};
      for (const result of results) {
        const lid = result.lead_id || result.company_name || 'unknown';
        newProgress[lid] = {
          id: lid,
          company: result.company_name || lid,
          status: result.success ? 'done' : 'error',
          vercel_url: result.final_url,
          html_size: result.html_size,
          error: result.error,
          email_subject: result.email_subject,
          email_body: result.email_body,
          send_status: result.send_status,
          send_error: result.send_error,
        };
      }
      setLeadProgress(newProgress);
      setResults(results);
      setPipelineStatus('completed');

    } catch (err) {
      console.error('[Modal call error]', err);
      setError(String(err));
      setPipelineStatus('error');
    }
  }

  function handleSaveSettings(s: AppSettings) {
    setSettings(s);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vercel_token: s.vercelToken || s.vercel_token || '',
        deepseek_key: s.deepseekKey || s.deepseek_key || '',
        groq_key: s.groqKey || s.groq_key || '',
        gmail_email: s.gmailEmail || s.gmail_email || '',
        gmail_app_password: s.gmailAppPassword || s.gmail_app_password || '',
      }),
    }).catch(() => {});
  }

  function reset() {
    setRunId(null); setLeads([]); setLeadProgress({}); setResults([]);
    setUploadedFileName(null); setPipelineStatus('idle');
    eventSourceRef.current?.close();
  }

  const totalCount = Object.values(leadProgress).length || leads.length;
  const doneCount = Object.values(leadProgress).filter(l => l.status === 'done').length;
  const activeCount = Object.values(leadProgress).filter(l => ['queued','scraping','generating','deploying','sending'].includes(l.status)).length;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border bg-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold">L</div>
            <span className="font-semibold text-sm">Lead-to-Site</span>
          </div>
          <button onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface transition-colors">
            <span>⚙</span><span>Settings</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Personalized Outreach Pipeline</h1>
          <p className="text-text-muted text-sm mt-1">CSV → Scrape → Branded Site → Deploy → Send Email</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* Upload Section */}
        {!runId && (
          <div className="space-y-4 fade-up">
            <DropZone onFile={handleFile} disabled={false} />
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Required CSV columns</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ['company_name', 'Apex Digital Marketing'],
                  ['website_url', 'https://apexdigital.com'],
                  ['email', 'contact@apexdigital.com'],
                  ['owner_name', 'Sarah Chen'],
                  ['industry', 'Digital Marketing'],
                  ['brand_color', '#4F46E5'],
                ].map(([col, eg]) => (
                  <div key={col} className="bg-surface-2 rounded-lg px-3 py-2">
                    <code className="text-[11px] text-accent font-mono">{col}</code>
                    <p className="text-[10px] text-text-muted mt-0.5 truncate">{eg}</p>
                  </div>
                ))}
              </div>
              <a href="/api/sample" download="sample_leads.csv"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-accent hover:text-accent-hover transition-colors">
                📥 Download sample CSV
              </a>
            </div>
          </div>
        )}

        {/* Pipeline Running */}
        {runId && (
          <div className="space-y-4 fade-up">
            {/* Controls bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl bg-surface border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                  <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full shrink-0">{totalCount} leads</span>
                </div>
                {pipelineStatus === 'running' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
                      <span>{activeCount > 0 ? `${doneCount}/${totalCount} done` : 'Starting...'}</span>
                      <span>{totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${totalCount > 0 ? (doneCount / totalCount * 100) : 0}%` }} />
                    </div>
                  </div>
                )}
                {pipelineStatus === 'completed' && (
                  <p className="text-xs text-success mt-1">
                    ✓ Complete — {doneCount}/{totalCount} done
                  </p>
                )}
                {pipelineStatus === 'error' && <p className="text-xs text-error mt-1">✗ Encountered errors</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {(pipelineStatus === 'idle') && (
                  <>
                    <button onClick={reset} className="px-3.5 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 transition-colors">Change file</button>
                    <button onClick={startPipeline}
                      className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                      <span>▶</span> Run Pipeline
                    </button>
                  </>
                )}
                {pipelineStatus === 'running' && (
                  <span className="px-3.5 py-2 rounded-lg bg-surface-2 text-xs text-text-muted flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent pulse" />Running...
                  </span>
                )}
                {pipelineStatus === 'completed' && (
                  <>
                    <button onClick={reset} className="px-3.5 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 transition-colors">New upload</button>
                    <button onClick={startPipeline} className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-border text-xs font-medium transition-colors">Run again</button>
                    {results.length > 0 && (
                      <button onClick={() => exportCSV(results, leads)}
                        className="px-4 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition-colors">
                        📥 Export CSV
                      </button>
                    )}
                  </>
                )}
                {pipelineStatus === 'error' && (
                  <>
                    <button onClick={reset} className="px-3.5 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 transition-colors">New upload</button>
                    <button onClick={startPipeline} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors">Retry</button>
                  </>
                )}
              </div>
            </div>

            {/* Analytics (after completion) */}
            {pipelineStatus === 'completed' && results.length > 0 && (
              <div className="fade-up">
                <AnalyticsCards results={results} leads={leads} />
              </div>
            )}

            {/* Live progress rows (running or idle) */}
            {(pipelineStatus === 'running' || pipelineStatus === 'idle') && Object.keys(leadProgress).length > 0 && (
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
                  {pipelineStatus === 'running' ? 'Processing...' : 'Ready to run'}
                </p>
                <div className="grid gap-2">
                  {Object.values(leadProgress).map(lp => (
                    <div key={lp.id} className="fade-up flex items-start gap-3 py-3 px-4 rounded-xl bg-surface border border-border hover:border-text-muted transition-colors">
                      <div className={cn(
                        'w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm',
                        lp.status === 'done' ? 'bg-success/15 text-success' :
                        lp.status === 'error' ? 'bg-error/15 text-error' :
                        'bg-surface-2 text-text-muted'
                      )}>
                        {lp.status === 'done' ? '✓' : lp.status === 'error' ? '✗' : lp.company.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-text truncate">{lp.company}</p>
                          <StatusBadge status={lp.status} />
                        </div>
                        {['queued','scraping','generating','deploying','sending'].includes(lp.status) && <StepBar step={lp.status} />}
                        {lp.html_size && <p className="text-[11px] text-text-muted mt-1">HTML: {(lp.html_size / 1024).toFixed(1)} KB</p>}
                        {lp.error && <p className="text-[11px] text-error mt-1 truncate">{lp.error}</p>}
                      </div>
                      {lp.vercel_url && (
                        <a href={lp.vercel_url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[11px] px-2.5 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors font-medium">
                          View →
                        </a>
                      )}
                      {lp.send_status === 'sent' && (
                        <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 font-medium">✉ Sent</span>
                      )}
                      {lp.send_status === 'pending_gmail' && (
                        <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-md bg-warning/10 text-warning font-medium">⏳ Gmail needed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final results table (after completion) */}
            {pipelineStatus === 'completed' && results.length > 0 && (
              <div className="fade-up border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-surface border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full',
                      results.every(r => r.status === 'success') ? 'bg-success' : 'bg-warning'
                    )} />
                    <span className="text-sm font-medium">Results</span>
                    <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                      {results.filter(r => r.status === 'success').length}/{results.length} deployed
                    </span>
                    <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                      {results.filter(r => r.send_status === 'sent').length} sent
                    </span>
                  </div>
                </div>
                {results.map(r => <ResultRow key={r.lead_id} result={r} leads={leads} />)}
              </div>
            )}

            {/* Token warnings */}
            {!settings.vercelToken && !settings.vercel_token && pipelineStatus !== 'running' && (
              <div className="fade-up px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span><strong>Vercel token missing.</strong> Sites will be generated but not deployed.
                  <button onClick={() => setSettingsOpen(true)} className="ml-1 underline hover:no-underline">Add token →</button>
                </span>
              </div>
            )}
            {!settings.gmailEmail && !settings.gmail_email && pipelineStatus !== 'running' && (
              <div className="fade-up px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs flex items-start gap-2">
                <span className="shrink-0 mt-0.5">✉</span>
                <span><strong>Gmail not configured.</strong> Emails will be generated but not sent. You'll see "Gmail needed" for all leads.
                  <button onClick={() => setSettingsOpen(true)} className="ml-1 underline hover:no-underline">Add Gmail →</button>
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        settings={settings}
      />
    </div>
  );
}
