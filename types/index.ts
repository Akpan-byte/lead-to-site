// ─── Core Types ─────────────────────────────────────────────────────────────

export interface Lead {
  id?: string;
  company_name?: string;
  industry?: string;
  location?: string;
  website_url?: string;
  owner_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  contact_email?: string;
  phone?: string;
  services?: string;
  brand_color?: string;
  secondary_color?: string;
  tagline?: string;
  // Scraped data (populated by pipeline)
  scraped_title?: string;
  scraped_description?: string;
  scraped_emails?: string[];
  scraped_phones?: string[];
  // DeepSeek analysis (populated by pipeline)
  deepseek_analysis?: DeepSeekAnalysis;
}

export interface DeepSeekAnalysis {
  agency_pitch?: string;
  pain_points?: string[];
  personalized_opening?: string;
  recommended_services?: string[];
  best_approach?: string;
}

// ─── SSE Event Types ─────────────────────────────────────────────────────────

export type LeadStatus =
  | 'idle'
  | 'queued'
  | 'scraping'
  | 'generating'
  | 'deploying'
  | 'sending'
  | 'done'
  | 'error';

export type SendStatus = 'pending_gmail' | 'sent' | 'failed';

export interface SSEEvent {
  id?: string;
  company?: string;
  status: LeadStatus | 'complete';
  error?: string;
  url?: string;
  vercel_url?: string;
  html_size?: number;
  total?: number;
  email_subject?: string;
  email_body?: string;
  send_status?: SendStatus;
  send_error?: string;
}

export interface LeadProgress {
  id: string;
  company: string;
  status: LeadStatus;
  url?: string;
  vercel_url?: string;
  html_size?: number;
  error?: string;
  email_subject?: string;
  email_body?: string;
  send_status?: SendStatus;
  send_error?: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface UploadResponse {
  run_id: string;
  leads_count: number;
  leads: Lead[];
}

export interface PipelineStep {
  status: 'ok' | 'skipped' | 'failed' | 'sent';
  reason?: string;
  error?: string;
  size_bytes?: number;
  url?: string;
  data?: Record<string, unknown>;
}

export interface PipelineResult {
  lead_id: string;
  company_name: string;
  status: 'success' | 'error';
  html_path?: string;
  html_size?: number;
  final_url?: string;
  error?: string;
  email_subject?: string;
  email_body?: string;
  send_status?: SendStatus;
  send_error?: string;
  steps: {
    scrape?: PipelineStep;
    generate_html?: PipelineStep;
    vercel_deploy?: PipelineStep;
    email?: PipelineStep;
    gmail_send?: PipelineStep;
    smartlead_ready?: PipelineStep;
  };
}

export interface StatusResponse {
  run_id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  leads_count: number;
  leads: Lead[];
  lead_progress: Record<string, LeadProgress>;
  results?: PipelineResult[];
}

export interface ResultsResponse {
  run_id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  leads_count: number;
  results: PipelineResult[];
}

// ─── Settings Types ─────────────────────────────────────────────────────────

export interface AppSettings {
  vercel_token: string;
  deepseek_key: string;
  groq_key: string;
  gmail_email: string;
  gmail_app_password: string;
}
