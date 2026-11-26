import { mockRequest } from './mockApi.js';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const isMockApi = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API !== 'false';

export async function request(path, { token, ...options } = {}) {
  if (isMockApi) return mockRequest(path, { token, ...options });

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status}).`);
  return body;
}

export { baseUrl, isMockApi };
