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

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  idle:     { label: 'Idle',      color: 'text-text-muted', dot: 'bg-border' },
  queued:   { label: 'Queued',    color: 'text-info',       dot: 'bg-info pulse' },
  scraping: { label: 'Scraping',  color: 'text-warning',    dot: 'bg-warning pulse' },
  generating:{ label: 'Generating',color: 'text-accent',    dot: 'bg-accent pulse' },
  deploying: { label: 'Deploying', color: 'text-info',      dot: 'bg-info pulse' },
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

function SettingsModal({ open, onClose, onSave, vercelToken, deepseekKey }: {
  open: boolean; onClose: () => void;
  onSave: (v: string, d: string) => void;
  vercelToken: string; deepseekKey: string;
}) {
  const [v, setV] = useState(vercelToken);
  const [d, setD] = useState(deepseekKey);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">API Settings</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              Vercel API Token
            </label>
            <input
              type="password"
              value={v}
              onChange={e => setV(e.target.value)}
              placeholder="tok_xxxxxxxxxxxx"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-text-muted mt-1">From vercel.com/account/tokens — needs deploy permissions</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              DeepSeek API Key
            </label>
            <input
              type="password"
              value={d}
              onChange={e => setD(e.target.value)}
              placeholder="sk-xxxxxxxxxxxx"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-text-muted mt-1">Optional — for AI-powered content personalization</p>
          </div>

          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="text-[11px] text-text-muted">
              Tokens are stored server-side via environment variables. They are never sent to third parties.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(v, d); onClose(); }}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a .csv file');
      return;
    }
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
        <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-2xl">
          📄
        </div>
        <div>
          <p className="text-sm font-medium text-text">
            {dragging ? 'Drop your CSV here' : 'Drop CSV or click to browse'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            Required columns: company_name, website_url, email
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepBar({ step }: { step: string }) {
  const steps = ['scraping', 'generating', 'deploying'];
  const current = steps.indexOf(step);
  return (
    <div className="flex gap-1 mt-1">
      {steps.map((s, i) => (
        <div
          key={s}
          className={cn('h-1 flex-1 rounded-full transition-colors', i <= current ? 'bg-accent' : 'bg-border')}
        />
      ))}
    </div>
  );
}

// ─── Lead Row ─────────────────────────────────────────────────────────────────

function LeadRow({ lp }: { lp: LeadProgress }) {
  const active = ['queued', 'scraping', 'generating', 'deploying'].includes(lp.status);

  return (
    <div className={cn('fade-up flex items-start gap-3 py-3 px-4 rounded-xl bg-surface border border-border hover:border-text-muted transition-colors')}>
      {/* Icon */}
      <div className={cn(
        'w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm',
        lp.status === 'done' ? 'bg-success/15 text-success' :
        lp.status === 'error' ? 'bg-error/15 text-error' :
        'bg-surface-2 text-text-muted'
      )}>
        {lp.status === 'done' ? '✓' : lp.status === 'error' ? '✗' : lp.company.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text truncate">{lp.company}</p>
          <StatusBadge status={lp.status} />
        </div>

        {active && <StepBar step={lp.status} />}

        {lp.html_size && (
          <p className="text-[11px] text-text-muted mt-1">
            HTML: {(lp.html_size / 1024).toFixed(1)} KB
          </p>
        )}

        {lp.error && (
          <p className="text-[11px] text-error mt-1 truncate">{lp.error}</p>
        )}
      </div>

      {/* URL */}
      {lp.vercel_url && (
        <a
          href={lp.vercel_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[11px] px-2.5 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors font-medium"
        >
          View →
        </a>
      )}
    </div>
  );
}

// ─── Results Table ────────────────────────────────────────────────────────────

function ResultsTable({ results }: { results: PipelineResult[] }) {
  if (!results.length) return null;

  const allDone = results.every(r => r.status === 'success');

  return (
    <div className="fade-up border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-surface border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', allDone ? 'bg-success' : 'bg-warning')} />
          <span className="text-sm font-medium">{allDone ? 'All deployed!' : 'Results'}</span>
          <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
            {results.filter(r => r.status === 'success').length}/{results.length} done
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {results.map(r => (
          <div key={r.lead_id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50 transition-colors">
            <span className={cn(
              'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold',
              r.status === 'success' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
            )}>
              {r.status === 'success' ? '✓' : '✗'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.company_name}</p>
              {r.steps?.scrape && (
                <p className="text-[11px] text-text-muted">
                  {r.steps.scrape.status === 'ok' ? '✓ Scraped' : '— No scrape'}
                </p>
              )}
            </div>
            {r.final_url ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-text-muted truncate max-w-[140px]">{r.final_url}</span>
                <a href={r.final_url} target="_blank" rel="noopener noreferrer"
                   className="text-[11px] px-2.5 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 font-medium transition-colors">
                  Open
                </a>
              </div>
            ) : r.status === 'error' ? (
              <span className="text-[11px] text-error shrink-0">Failed</span>
            ) : null}
            <span className="text-[11px] text-text-muted shrink-0">
              {r.html_size ? `${(r.html_size / 1024).toFixed(0)}KB` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [runId, setRunId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadProgress, setLeadProgress] = useState<Record<string, LeadProgress>>({});
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<PipelineResult[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vercelToken, setVercelToken] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragFile, setDragFile] = useState<File | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings from env on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.vercel_token) setVercelToken(d.vercel_token);
        if (d.deepseek_key) setDeepseekKey(d.deepseek_key);
      })
      .catch(() => {});
  }, []);

  // Poll for status when we have a runId
  useEffect(() => {
    if (!runId) return;
    const poll = setInterval(async () => {
      try {
        const data = await getRunStatus(runId);
        setPipelineStatus(data.status);
        if (data.lead_progress) setLeadProgress(data.lead_progress);
        if (data.results?.length) setResults(data.results);
      } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, [runId]);

  async function handleFile(file: File) {
    setDragFile(file);
    setError(null);
    try {
      const { run_id, leads_count } = await uploadCSV(file);
      setRunId(run_id);
      setUploadedFileName(file.name);
      setLeads([]);
      setLeadProgress({});
      setResults([]);
      setPipelineStatus('idle');

      // Poll to get leads
      const data = await getRunStatus(run_id);
      setLeads(data.leads || []);
      setLeadProgress(data.lead_progress || {});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function startPipeline() {
    if (!runId) return;
    setError(null);
    setPipelineStatus('running');

    // Clear previous results
    setResults({});
    setLeadProgress(prev => {
      const next: Record<string, LeadProgress> = {};
      for (const [id, lp] of Object.entries(prev)) {
        next[id] = { ...lp, status: 'queued' };
      }
      return next;
    });

    // Close any existing SSE
    eventSourceRef.current?.close();

    const sse = new EventSource(`/api/pipeline/${runId}/run`);
    eventSourceRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        if (event.status === 'complete') {
          sse.close();
          setPipelineStatus('completed');
          // Fetch final results
          getRunStatus(runId).then(d => {
            setLeadProgress(d.lead_progress || {});
            setResults(d.results || []);
          });
          return;
        }
        if (event.status === 'error') {
          setError(event.error || 'Pipeline error');
          sse.close();
          setPipelineStatus('error');
          return;
        }

        if (event.id) {
          setLeadProgress(prev => {
            const existing = prev[event.id!];
            return {
              ...prev,
              [event.id!]: existing
                ? { ...existing, status: event.status as LeadProgress['status'], vercel_url: event.vercel_url, html_size: event.html_size, error: event.error }
                : { id: event.id!, company: event.company || event.id!, status: event.status as LeadProgress['status'], vercel_url: event.vercel_url, html_size: event.html_size, error: event.error },
            };
          });
        }
      } catch {}
    };

    sse.onerror = () => {
      sse.close();
      setPipelineStatus(prev => prev === 'running' ? 'error' : prev);
    };
  }

  function handleSaveSettings(v: string, d: string) {
    setVercelToken(v);
    setDeepseekKey(d);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercel_token: v, deepseek_key: d }),
    }).catch(() => {});
  }

  const doneCount = Object.values(leadProgress).filter(l => l.status === 'done').length;
  const totalCount = Object.values(leadProgress).length || leads.length;
  const activeCount = Object.values(leadProgress).filter(l => ['queued', 'scraping', 'generating', 'deploying'].includes(l.status)).length;
  const errorCount = Object.values(leadProgress).filter(l => l.status === 'error').length;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* ── Header ── */}
      <header className="border-b border-border bg-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold">
              L
            </div>
            <span className="font-semibold text-sm">Lead-to-Site</span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <span>⚙</span>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Personalized Outreach Pipeline</h1>
          <p className="text-text-muted text-sm mt-1">
            Upload a CSV → scrape websites → generate branded landing pages → deploy to Vercel
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Upload Section ── */}
        {!runId && (
          <div className="fade-up space-y-4">
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
              <a
                href="/api/sample"
                download="sample_leads.csv"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                📥 Download sample CSV
              </a>
            </div>
          </div>
        )}

        {/* ── After Upload ── */}
        {runId && (
          <div className="space-y-4 fade-up">
            {/* Pipeline controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl bg-surface border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                  <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full shrink-0">
                    {totalCount} lead{totalCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {pipelineStatus === 'running' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
                      <span>{activeCount > 0 ? `${doneCount}/${totalCount} processed` : 'Starting...'}</span>
                      <span>{doneCount > 0 ? Math.round(doneCount / totalCount * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full progress-anim transition-all"
                        style={{ width: `${totalCount > 0 ? (doneCount / totalCount * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {pipelineStatus === 'completed' && (
                  <p className="text-xs text-success mt-1">✓ Pipeline complete — {doneCount} site{doneCount !== 1 ? 's' : ''} generated</p>
                )}
                {pipelineStatus === 'error' && (
                  <p className="text-xs text-error mt-1">✗ Pipeline encountered errors</p>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {pipelineStatus === 'idle' && (
                  <>
                    <button
                      onClick={() => { setRunId(null); setLeads([]); setLeadProgress({}); setResults([]); setUploadedFileName(null); }}
                      className="px-3.5 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 transition-colors"
                    >
                      Change file
                    </button>
                    <button
                      onClick={startPipeline}
                      className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <span>▶</span> Run Pipeline
                    </button>
                  </>
                )}
                {pipelineStatus === 'running' && (
                  <span className="px-3.5 py-2 rounded-lg bg-surface-2 text-xs text-text-muted flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent pulse" />
                    Running...
                  </span>
                )}
                {(pipelineStatus === 'completed' || pipelineStatus === 'error') && (
                  <>
                    <button
                      onClick={() => { setRunId(null); setLeads([]); setLeadProgress({}); setResults([]); setUploadedFileName(null); }}
                      className="px-3.5 py-2 rounded-lg border border-border text-xs text-text-muted hover:bg-surface-2 transition-colors"
                    >
                      New upload
                    </button>
                    <button
                      onClick={startPipeline}
                      className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-border text-xs font-medium transition-colors"
                    >
                      Run again
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Live lead progress */}
            {(pipelineStatus === 'running' || pipelineStatus === 'idle') && Object.keys(leadProgress).length > 0 && (
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
                  {pipelineStatus === 'running' ? 'Processing...' : 'Ready to run'}
                </p>
                <div className="grid gap-2">
                  {Object.values(leadProgress).map(lp => (
                    <LeadRow key={lp.id} lp={lp} />
                  ))}
                </div>
              </div>
            )}

            {/* Final results */}
            {pipelineStatus === 'completed' && <ResultsTable results={results} />}

            {/* Token warning */}
            {!vercelToken && pipelineStatus !== 'running' && (
              <div className="fade-up px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>
                  <strong>Vercel token not set.</strong> Sites will be generated but not deployed.
                  <button onClick={() => setSettingsOpen(true)} className="ml-1 underline hover:no-underline">
                    Add token →
                  </button>
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
        vercelToken={vercelToken}
        deepseekKey={deepseekKey}
      />
    </div>
  );
}
