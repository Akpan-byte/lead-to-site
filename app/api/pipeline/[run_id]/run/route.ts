import { NextRequest } from 'next/server';

// Force dynamic — cannot be statically exported since this is a streaming SSE endpoint
export const dynamic = 'force-dynamic';

// Modal endpoint - change this if you redeploy with different user
const MODAL_BATCH_URL = 'https://theakpanobong--lead-to-site-process-batch-endpoint.modal.run';

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

// No filesystem - leads come from request body

// ─── SSE Route ────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  const { run_id: runId } = await params;

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
        
        // Get leads from request body (sent by browser)
        const body = await request.json().catch(() => ({}));
        const leads = body.leads || [];
        
        if (!leads || leads.length === 0) {
          send({ id: 'error', company: '', status: 'error', error: 'No leads provided. Upload CSV first.' });
          controller.close();
          return;
        }

        if (!runData) {
          const leadProgress: Record<string, LeadProgress> = {};
          for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            const lid = lead.id || lead.email || `lead_${i}`;
            leadProgress[lid] = { id: lid, company: lead.company_name || 'Unknown', status: 'queued' };
          }
          runData = { status: 'idle' as const, leads, leadProgress, results: [] as PipelineResult[] };
          pipelineRuns.set(runId, runData);
        }

        if (runData.status === 'running') {
          send({ id: 'error', company: '', status: 'error', error: 'Pipeline already running.' });
          controller.close();
          return;
        }

        runData.status = 'running';
        pipelineRuns.set(runId, runData);

        // Send to Modal batch endpoint
        const modalPayload = { leads };
        
        try {
          send({ id: 'modal', company: '', status: 'queued', vercel_url: 'Sending to Modal...' });
          
          const modalRes = await fetch(MODAL_BATCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modalPayload),
          });
          
          if (!modalRes.ok) {
            throw new Error(`Modal error: ${modalRes.status} ${modalRes.statusText}`);
          }
          
          const modalData = await modalRes.json();
          
          // Process results from Modal
          const results = modalData.results || [];
          for (const result of results) {
            const lid = result.lead_id || result.company_name || 'unknown';
            if (runData.leadProgress[lid]) {
              runData.leadProgress[lid].status = result.success ? 'done' : 'error';
              runData.leadProgress[lid].vercel_url = result.final_url;
              runData.leadProgress[lid].error = result.error;
            }
          }
          
          runData.status = 'completed';
          runData.results = results;
          pipelineRuns.set(runId, runData);
          
          send({ 
            status: 'complete', 
            id: runId, 
            company: `Pipeline completed`,
            vercel_url: `${results.filter((r: PipelineResult) => r.final_url).length} sites deployed`,
          });
          
        } catch (err) {
          console.error('[Modal call error]', err);
          runData.status = 'error';
          pipelineRuns.set(runId, runData);
          send({ id: 'error', company: '', status: 'error', error: String(err) });
        }

        controller.close();

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
