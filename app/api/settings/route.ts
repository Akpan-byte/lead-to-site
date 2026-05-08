import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = '/tmp/lead-to-site/config.json';

export async function GET() {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return NextResponse.json({
        vercel_token: '', deepseek_key: '', groq_key: '',
        gmail_email: '', gmail_app_password: '',
      });
    }
    const data = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
    return NextResponse.json({
      vercel_token: data.vercel_token || '',
      deepseek_key: data.deepseek_key || '',
      groq_key: data.groq_key || '',
      gmail_email: data.gmail_email || '',
      gmail_app_password: data.gmail_app_password || '',
    });
  } catch {
    return NextResponse.json({
      vercel_token: '', deepseek_key: '', groq_key: '',
      gmail_email: '', gmail_app_password: '',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const configDir = '/tmp/lead-to-site';
    await mkdir(configDir, { recursive: true });

    // Load existing config to merge
    let config: Record<string, unknown> = {};
    if (existsSync(CONFIG_PATH)) {
      try {
        config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
      } catch { /* start fresh */ }
    }

    // Update only provided fields
    if (body.vercel_token !== undefined) {
      config.vercel_token = body.vercel_token || undefined;
    }
    if (body.deepseek_key !== undefined) {
      config.deepseek_key = body.deepseek_key || undefined;
    }
    if (body.groq_key !== undefined) {
      config.groq_key = body.groq_key || undefined;
    }
    if (body.gmail_email !== undefined) {
      config.gmail_email = body.gmail_email || undefined;
    }
    if (body.gmail_app_password !== undefined) {
      config.gmail_app_password = body.gmail_app_password || undefined;
    }
    if (body.from_name !== undefined) {
      config.from_name = body.from_name || undefined;
    }

    // Remove undefined keys
    Object.keys(config).forEach(k => config[k] === undefined && delete config[k]);

    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return NextResponse.json({ saved: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
