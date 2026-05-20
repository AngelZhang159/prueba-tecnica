export const BASE_URL = import.meta.env.API_URL ?? 'http://localhost:3000';

async function request(path: string, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

export const get = (path: string) => request(path);
export const post = (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path: string, body: any) => request(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = (path: string) => request(path, { method: 'DELETE' });