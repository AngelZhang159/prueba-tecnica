import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/db/pool.js', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn()
  }
}));

import app from '../src/app.js';
import pool from '../src/db/pool.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/productos', () => {
  it('devuelve 200 con valores por defecto y datos', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Laptop' }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app).get('/api/productos');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 1 });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM productos'),
      ['%%', 10, 0]
    );
  });

  it('ajusta el limite maximo, recorta la busqueda y aplica paginacion', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const res = await request(app).get('/api/productos?page=2&limit=500&search= laptop ');

    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM productos'),
      ['%laptop%', 100, 100]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('COUNT'),
      ['%laptop%']
    );
  });

  it('devuelve 500 cuando falla la base de datos', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/api/productos');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db down');
  });
});

describe('Fallback handler', () => {
  it('devuelve 404 para rutas desconocidas', async () => {
    const res = await request(app).get('/api/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Endpoint no encontrado' });
  });
});