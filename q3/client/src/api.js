import { mockRequest } from './mockApi.js';

const baseUrl = import.meta.env.VITE_API_URL || '';
const useDemoApi = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API !== 'false';

export async function api(path, { token, ...options } = {}) {
  if (useDemoApi) return mockRequest(path, { token, ...options });

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}
