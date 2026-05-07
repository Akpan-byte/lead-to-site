import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = '/tmp/lead-to-site/settings.json';

export async function GET() {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return NextResponse.json({ vercel_token: '', deepseek_key: '' });
    }
    const data = JSON.parse(await import('fs/promises').then(fs => fs.readFile(CONFIG_PATH, 'utf-8')));
    return NextResponse.json({ vercel_token: data.vercel_token || '', deepseek_key: data.deepseek_key || '' });
  } catch {
    return NextResponse.json({ vercel_token: '', deepseek_key: '' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = {
      vercel_token: body.vercel_token || '',
      deepseek_key: body.deepseek_key || '',
    };
    await writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
