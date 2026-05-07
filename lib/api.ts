import axios from 'axios';
import type { UploadResponse, StatusResponse, ResultsResponse, SSEEvent, AppSettings } from '@/types';

const api = axios.create({
  baseURL: '',
});

export const apiClient = {
  // Upload CSV and get run_id
  async uploadCSV(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<UploadResponse>('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Get pipeline status
  async getStatus(runId: string): Promise<StatusResponse> {
    const response = await api.get<StatusResponse>(`/api/pipeline/${runId}/status`);
    return response.data;
  },

  // Get results
  async getResults(runId: string): Promise<ResultsResponse> {
    const response = await api.get<ResultsResponse>(`/api/pipeline/${runId}/results`);
    return response.data;
  },

  // Get generated website HTML
  async getWebsiteHtml(runId: string, leadId: string): Promise<string> {
    const response = await api.get(`/api/pipeline/${runId}/website/${leadId}`);
    return response.data;
  },

  // Save settings to localStorage
  saveSettings(settings: AppSettings): void {
    localStorage.setItem('lead_to_site_settings', JSON.stringify(settings));
  },

  // Load settings from localStorage
  loadSettings(): AppSettings {
    const stored = localStorage.getItem('lead_to_site_settings');
    if (stored) {
      return JSON.parse(stored);
    }
    return { vercel_token: '', deepseek_key: '' };
  },
};

// SSE streaming for real-time progress
export function createPipelineStream(
  runId: string,
  onEvent: (event: SSEEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): EventSource {
  const eventSource = new EventSource(`/api/pipeline/${runId}/run`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SSEEvent;
      onEvent(data);
      if (data.status === 'done' || data.status === 'error') {
        // Don't close yet, let the stream end naturally
      }
    } catch (err) {
      console.error('Failed to parse SSE event:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.error('SSE error:', err);
    onError(new Error('SSE connection error'));
    eventSource.close();
  };

  eventSource.addEventListener('complete', () => {
    onComplete();
    eventSource.close();
  });

  return eventSource;
}
