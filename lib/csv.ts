import Papa from 'papaparse';
import type { Lead } from '@/types';

export function parseCSV(file: File): Promise<Lead[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Lead>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const leads = results.data.filter(row => row.company_name || row.email);
        resolve(leads);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

export function downloadCSV(data: Record<string, unknown>[], filename: string): void {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
