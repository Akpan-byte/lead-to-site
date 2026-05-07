import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { parse } from 'path';
import Papa from 'papaparse';
import type { Lead } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    // Generate run_id
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const outputDir = `/tmp/lead-to-site/${runId}`;

    // Create output directory
    await mkdir(outputDir, { recursive: true });

    // Read and parse CSV
    const text = await file.text();
    const results = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (results.errors.length > 0) {
      return NextResponse.json(
        { error: 'CSV parsing error', details: results.errors },
        { status: 400 }
      );
    }

    // Validate required fields
    const leads = results.data as Lead[];
    const validLeads = leads.filter(row => row.company_name || row.email);

    if (validLeads.length === 0) {
      return NextResponse.json(
        { error: 'CSV must have at least one lead with company_name or email' },
        { status: 400 }
      );
    }

    // Save CSV to output directory
    const csvPath = `${outputDir}/input.csv`;
    await writeFile(csvPath, text, 'utf-8');

    return NextResponse.json({
      run_id: runId,
      leads_count: validLeads.length,
      leads: validLeads,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV', details: String(error) },
      { status: 500 }
    );
  }
}
