const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function request(path, { token, ...options } = {}) {
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

export { baseUrl };
