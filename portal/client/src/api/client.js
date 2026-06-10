const API_URL = import.meta.env.VITE_PORTAL_API_URL || '';

export class ApiError extends Error {
  constructor(message, { status, payload, path } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.path = path;
  }
}

export async function api(path, options = {}) {
  const { suppressAuthRedirect = false, headers = {}, ...fetchOptions } = options;
  const isFormData = fetchOptions.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...fetchOptions,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload.error ? payload.error : 'Request failed';
    const error = new ApiError(message, { status: response.status, payload, path });
    if (response.status === 401 && !suppressAuthRedirect && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('portal-auth-required', { detail: { path } }));
    }
    throw error;
  }

  return payload;
}

export function documentDownloadUrl(id) {
  return `${API_URL}/api/documents/${id}/download`;
}

export function documentViewUrl(id) {
  return `${API_URL}/api/documents/${id}/view`;
}

export function employmentFileDownloadUrl(applicationId, fileId) {
  return `${API_URL}/api/admin/employment-applications/${applicationId}/files/${fileId}/download`;
}

export function employmentFileViewUrl(applicationId, fileId) {
  return `${API_URL}/api/admin/employment-applications/${applicationId}/files/${fileId}/view`;
}

export function apiUrl(path) {
  return `${API_URL}${path}`;
}

export async function uploadDocument(id, file) {
  const form = new FormData();
  form.append('file', file);
  return api(`/api/documents/${id}/upload`, {
    method: 'POST',
    body: form
  });
}
