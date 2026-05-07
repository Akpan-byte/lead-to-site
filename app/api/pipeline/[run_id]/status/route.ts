import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';
import type { Lead, LeadProgress, PipelineResult } from '../../../../types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory store for pipeline runs (in production, use Redis or a database)
const pipelineRuns: Map<string, {
  status: 'idle' | 'running' | 'completed' | 'error';
  leads: Lead[];
  leadProgress: Record<string, LeadProgress>;
  results: PipelineResult[];
}> = new Map();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  const { run_id: runId } = await params;
  const outputDir = `/tmp/lead-to-site/${runId}`;

  // Check if we have data in memory
  let runData = pipelineRuns.get(runId);

  if (!runData) {
    // Try to load from disk
    const csvPath = join(outputDir, 'input.csv');
    if (existsSync(csvPath)) {
      try {
        const csvContent = await readFile(csvPath, 'utf-8');
        const results = Papa.parse<Record<string, string>>(csvContent, {
          header: true,
          skipEmptyLines: true,
        });
        const leads = results.data as Lead[];

        runData = {
          status: 'idle',
          leads,
          leadProgress: {},
          results: [],
        };

        // Initialize lead progress
        for (const lead of leads) {
          const leadId = lead.id || lead.email || `lead_${Math.random().toString(36).substring(2, 8)}`;
          runData.leadProgress[leadId] = {
            id: leadId,
            company: lead.company_name,
            status: 'idle',
          };
        }

        pipelineRuns.set(runId, runData);
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to load pipeline data' },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Pipeline run not found' },
        { status: 404 }
      );
    }
  }

  // Check for results file
  const resultsPath = join(outputDir, 'results.json');
  if (existsSync(resultsPath) && runData.status === 'idle') {
    try {
      const resultsContent = await readFile(resultsPath, 'utf-8');
      runData.results = JSON.parse(resultsContent);
      runData.status = 'completed';
      pipelineRuns.set(runId, runData);
    } catch {
      // Ignore
    }
  }

  return NextResponse.json({
    run_id: runId,
    status: runData.status,
    leads: runData.leads,
    lead_progress: runData.leadProgress,
  });
}

// Export the pipeline runs map for use by other routes
export { pipelineRuns };
