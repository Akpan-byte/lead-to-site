import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export async function GET() {
  const path = '/config/lead-to-site/sample_leads.csv';
  if (!existsSync(path)) {
    return NextResponse.json({ error: 'Sample CSV not found' }, { status: 404 });
  }
  const content = await readFile(path, 'utf-8');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="sample_leads.csv"',
    },
  });
}
