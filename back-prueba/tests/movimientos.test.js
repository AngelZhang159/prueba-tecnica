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

const createClient = () => ({
  query: vi.fn(),
  release: vi.fn()
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/movimientos', () => {
  it('devuelve 400 cuando faltan campos requeridos', async () => {
    const res = await request(app).post('/api/movimientos').send({});

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(
      expect.arrayContaining(['producto_id', 'cantidad', 'tipo'])
    );
  });

  it('devuelve 400 cuando los valores son invalidos', async () => {
    const res = await request(app)
      .post('/api/movimientos')
      .send({ producto_id: 0, cantidad: -3, tipo: 'otro' });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(
      expect.arrayContaining(['producto_id', 'cantidad', 'tipo'])
    );
  });

  it('devuelve 404 cuando el producto no existe', async () => {
    const client = createClient();
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/movimientos')
      .send({ producto_id: 999, cantidad: 2, tipo: 'entrada' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Producto no encontrado');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT stock FROM productos WHERE id = $1 FOR UPDATE',
      [999]
    );
  });

  it('devuelve 409 cuando el stock es insuficiente para salida', async () => {
    const client = createClient();
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ stock: 1 }] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/movimientos')
      .send({ producto_id: 1, cantidad: 3, tipo: 'salida' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Stock insuficiente');
  });

  it('devuelve 201 y actualiza el stock en caso de exito', async () => {
    const client = createClient();
    pool.connect.mockResolvedValueOnce(client);

    const inserted = {
      id: 10,
      producto_id: 1,
      cantidad: 5,
      tipo: 'entrada'
    };

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ stock: 10 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [inserted] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/movimientos')
      .send({ producto_id: 1, cantidad: 5, tipo: 'entrada' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(inserted);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      'UPDATE productos SET stock = $1 WHERE id = $2',
      [15, 1]
    );
  });

  it('revierte la transaccion y devuelve 500 cuando falla una consulta', async () => {
    const client = createClient();
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('db failure'))
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/movimientos')
      .send({ producto_id: 1, cantidad: 2, tipo: 'entrada' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db failure');
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
  });
});
