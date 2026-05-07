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
  status: 'idle' | 'queued' | 'scraping' | 'generating' | 'deploying' | 'done' | 'error';
  vercel_url?: string;
  html_size?: number;
  error?: string;
  url?: string;
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
        const env: Record<string, string> = {
          ...process.env as Record<string, string>,
          PYTHONUNBUFFERED: '1',
        };
        if (vercelToken) env.VERCEL_API_TOKEN = vercelToken;
        if (deepseekKey) env.DEEPSEEK_API_KEY = deepseekKey;

        const pythonProcess = spawn('python3', [
          '/config/lead-to-site/pipeline.py',
          '--csv', csvPath,
          '--json-output',
          '--output-dir', outputDir,
        ], { env });

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
                  done: 'done', complete: 'done',
                };
                const uiStatus = statusMap[event.status] || 'idle';
                runData!.leadProgress[event.id].status = uiStatus;
                if (event.vercel_url) runData!.leadProgress[event.id].vercel_url = event.vercel_url;
                if (event.html_size) runData!.leadProgress[event.id].html_size = event.html_size;
                if (event.error) runData!.leadProgress[event.id].error = event.error;
                if (event.url) runData!.leadProgress[event.id].url = event.url;
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
