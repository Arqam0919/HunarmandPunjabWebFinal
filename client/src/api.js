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
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Request failed.');
  return body;
}

export { baseUrl };
