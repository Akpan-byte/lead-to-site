import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Force dynamic — cannot be statically exported since this is a streaming SSE endpoint
export const dynamic = 'force-dynamic';

// ─── Inline types ─────────────────────────────────────────────────────────────

interface Lead {
  id?: string;
  company_name?: string;
  website_url?: string;
  email?: string;
  [key: string]: unknown;
}

interface LeadProgress {
  id: string;
  company: string;
  status: 'idle' | 'queued' | 'scraping' | 'generating' | 'deploying' | 'sending' | 'done' | 'error';
  vercel_url?: string;
  html_size?: number;
  error?: string;
  url?: string;
  email_subject?: string;
  email_body?: string;
  send_status?: 'pending_gmail' | 'sent' | 'failed';
  send_error?: string;
}

interface PipelineResult {
  lead_id: string;
  company_name: string;
  status: 'success' | 'error';
  html_path?: string;
  html_size?: number;
  final_url?: string;
  error?: string;
  steps: Record<string, unknown>;
  email_subject?: string;
  email_body?: string;
  send_status?: 'pending_gmail' | 'sent' | 'failed';
  send_error?: string;
}

interface SSEEvent {
  id?: string;
  company?: string;
  status: string;
  error?: string;
  url?: string;
  vercel_url?: string;
  html_size?: number;
  email_subject?: string;
  email_body?: string;
  send_status?: 'pending_gmail' | 'sent' | 'failed';
  send_error?: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const pipelineRuns = new Map<string, {
  status: 'idle' | 'running' | 'completed' | 'error';
  leads: Lead[];
  leadProgress: Record<string, LeadProgress>;
  results: PipelineResult[];
}>();

async function loadRunData(runId: string) {
  const outputDir = `/tmp/lead-to-site/${runId}`;
  const csvPath = join(outputDir, 'input.csv');
  if (!existsSync(csvPath)) return null;

  // Simple CSV parser
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const leads: Lead[] = [];
  const leadProgress: Record<string, LeadProgress> = {};

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const lead: Lead = {};
    headers.forEach((h, idx) => { lead[h] = values[idx] || ''; });
    if (lead.company_name || lead.email) {
      leads.push(lead);
      const lid = lead.id || lead.email || `lead_${i}`;
      leadProgress[lid] = { id: lid, company: lead.company_name || 'Unknown', status: 'idle' };
    }
  }

  return { status: 'idle' as const, leads, leadProgress, results: [] as PipelineResult[] };
}

// ─── SSE Route ────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  const { run_id: runId } = await params;
  const outputDir = `/tmp/lead-to-site/${runId}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* ignore */ }
      };

      try {
        let runData = pipelineRuns.get(runId);
        if (!runData) {
          const loaded = await loadRunData(runId);
          if (!loaded) {
            send({ id: 'error', company: '', status: 'error', error: 'Pipeline run not found. Upload CSV first.' });
            controller.close();
            return;
          }
          runData = loaded;
          pipelineRuns.set(runId, runData);
        }

        if (runData.status === 'running') {
          send({ id: 'error', company: '', status: 'error', error: 'Pipeline already running.' });
          controller.close();
          return;
        }

        runData.status = 'running';
        pipelineRuns.set(runId, runData);

        await mkdir(outputDir, { recursive: true });
        const csvPath = join(outputDir, 'input.csv');

        const vercelToken = process.env.VERCEL_API_TOKEN || '';
        const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
        const groqKey = process.env.GROQ_API_KEY || '';
        // Load Gmail config
        let gmailEmail = '';
        let gmailAppPassword = '';
        const cfgPath = '/tmp/lead-to-site/config.json';
        if (existsSync(cfgPath)) {
          try {
            const cfgData = JSON.parse(readFileSync(cfgPath, 'utf-8'));
            gmailEmail = cfgData.gmail_email || '';
            gmailAppPassword = cfgData.gmail_app_password || '';
          } catch { /* ignore */ }
        }
        const env: Record<string, string> = {
          ...process.env as Record<string, string>,
          PYTHONUNBUFFERED: '1',
        };
        if (vercelToken) env.VERCEL_API_TOKEN = vercelToken;
        if (deepseekKey) env.DEEPSEEK_API_KEY = deepseekKey;
        if (groqKey) env.GROQ_API_KEY = groqKey;

        const pythonProcess = spawn('python3', [
          '/config/lead-to-site/pipeline.py',
          '--csv', csvPath,
          '--json-output',
          '--output-dir', outputDir,
        ], {
          env: {
            ...process.env as Record<string, string>,
            PYTHONUNBUFFERED: '1',
            VERCEL_API_TOKEN: vercelToken,
            DEEPSEEK_API_KEY: deepseekKey,
            GROQ_API_KEY: groqKey,
            // Pass Gmail config directly so pipeline.py doesn't need to re-read it
            GMAIL_EMAIL: gmailEmail,
            GMAIL_APP_PASSWORD: gmailAppPassword,
          },
        });

        let lineBuffer = '';

        pythonProcess.stdout.on('data', (data: Buffer) => {
          lineBuffer += data.toString();
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event: SSEEvent = JSON.parse(line);

              if (event.id && event.id !== 'complete') {
                if (!runData!.leadProgress[event.id]) {
                  runData!.leadProgress[event.id] = {
                    id: event.id,
                    company: event.company || event.id,
                    status: 'queued',
                  };
                }
                const statusMap: Record<string, LeadProgress['status']> = {
                  queued: 'queued', scraping: 'scraping',
                  generating: 'generating', deploying: 'deploying',
                  sending: 'sending', done: 'done', complete: 'done',
                };
                const uiStatus = statusMap[event.status] || 'idle';
                runData!.leadProgress[event.id].status = uiStatus;
                if (event.vercel_url) runData!.leadProgress[event.id].vercel_url = event.vercel_url;
                if (event.html_size) runData!.leadProgress[event.id].html_size = event.html_size;
                if (event.error) runData!.leadProgress[event.id].error = event.error;
                if (event.url) runData!.leadProgress[event.id].url = event.url;
                if (event.email_subject) runData!.leadProgress[event.id].email_subject = event.email_subject;
                if (event.email_body) runData!.leadProgress[event.id].email_body = event.email_body;
                if (event.send_status) runData!.leadProgress[event.id].send_status = event.send_status;
                if (event.send_error) runData!.leadProgress[event.id].send_error = event.send_error;
                // 'sent' event is the final event — update to 'done' with send info
                if (event.status === 'sent') {
                  runData!.leadProgress[event.id].status = 'done';
                }
                pipelineRuns.set(runId, runData!);
              }

              send(event);
            } catch { /* non-JSON line */ }
          }
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
          console.error('[Pipeline stderr]', data.toString());
        });

        pythonProcess.on('close', async (code) => {
          runData!.status = code === 0 ? 'completed' : 'error';

          const resultsPath = join(outputDir, 'results.json');
          if (existsSync(resultsPath)) {
            try {
              const rc = JSON.parse(readFileSync(resultsPath, 'utf-8'));
              runData!.results = Array.isArray(rc) ? rc : (rc.results || []);
            } catch { /* ignore */ }
          }

          if (runData!.results.length === 0) {
            runData!.results = Object.values(runData!.leadProgress).map(lp => ({
              lead_id: lp.id,
              company_name: lp.company,
              status: lp.status === 'done' ? 'success' : 'error',
              steps: {},
              final_url: lp.vercel_url,
            }));
          }

          for (const [id, lp] of Object.entries(runData!.leadProgress)) {
            if (['queued', 'scraping', 'generating', 'deploying'].includes(lp.status)) {
              runData!.leadProgress[id].status = runData!.status === 'completed' ? 'done' : 'error';
            }
          }

          pipelineRuns.set(runId, runData!);

          send({
            status: 'complete',
            id: runId,
            company: `Pipeline ${runData!.status}`,
            error: runData!.status === 'error' ? 'Pipeline exited with errors' : undefined,
          });

          controller.close();
        });

        pythonProcess.on('error', (err) => {
          runData!.status = 'error';
          pipelineRuns.set(runId, runData!);
          send({ id: 'error', company: '', status: 'error', error: `Failed to start: ${err.message}` });
          controller.close();
        });

      } catch (err) {
        console.error('[SSE route error]', err);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'error', company: '', status: 'error', error: String(err),
          })}\n\n`));
        } catch { /* ignore */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export { pipelineRuns };
