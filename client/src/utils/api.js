// API Client helper
const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('ng_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `خطأ في الطلب (${res.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export function formatCurrency(amount, currency = 'DZD') {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `0 ${currency}`;
  }
  const num = parseFloat(amount);
  return `${num.toLocaleString('ar-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

export function exportToCsv(filename, headers, rows) {
  const bom = '\uFEFF'; // UTF-8 BOM for Arabic support in Excel
  const headerLine = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(r => r.map(val => {
    const str = val === null || val === undefined ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  }).join(','));

  const csvContent = bom + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
