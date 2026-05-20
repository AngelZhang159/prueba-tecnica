import express from 'express';

const app = express();
const port = 3000;

import pool from './db/pool.js';
import cors from 'cors';

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

const MAX_PAGE_SIZE = 100;
const ALLOWED_MOV_TYPES = new Set(['entrada', 'salida']);

const parseStrictPositiveInt = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

app.post('/api/movimientos', async (req, res) => {
    const { producto_id: rawProductoId, cantidad: rawCantidad, tipo: rawTipo } = req.body ?? {};
    const productoId = parseStrictPositiveInt(rawProductoId);
    const cantidad = parseStrictPositiveInt(rawCantidad);
    const tipo = normalizeText(rawTipo).toLowerCase();

    const validationErrors = [];
    if (!productoId) {
        validationErrors.push('producto_id');
    }
    if (!cantidad) {
        validationErrors.push('cantidad');
    }
    if (!ALLOWED_MOV_TYPES.has(tipo)) {
        validationErrors.push('tipo');
    }

    if (validationErrors.length > 0) {
        return res.status(400).json({
            error: 'Solicitud invalida',
            fields: validationErrors
        });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const productoResult = await client.query(
            'SELECT stock FROM productos WHERE id = $1 FOR UPDATE',
            [productoId]
        );

        if (productoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const productoStock = Number(productoResult.rows[0].stock) || 0;
        const stockDelta = tipo === 'salida' ? -cantidad : cantidad;
        const nextStock = productoStock + stockDelta;

        if (nextStock < 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Stock insuficiente' });
        }

        await client.query(
            'UPDATE productos SET stock = $1 WHERE id = $2',
            [nextStock, productoId]
        );

        const result = await client.query(
            'INSERT INTO historial_stock (producto_id, cantidad, tipo) VALUES ($1, $2, $3) RETURNING *',
            [productoId, cantidad, tipo]
        );

        await client.query('COMMIT');
        if (nextStock === 0) {
            notifyOutOfStock(productoId);
        }

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error al revertir la transaccion', rollbackError);
            }
        }

        const message = err instanceof Error ? err.message : 'Error inesperado';
        return res.status(500).json({ error: message });
    } finally {
        if (client) {
            client.release();
        }
    }
});

app.get('/api/productos', async (req, res) => {
    try {
        const pageRaw = Number.parseInt(req.query.page);
        const limitRaw = Number.parseInt(req.query.limit);

        const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
        const limit = Number.isInteger(limitRaw) && limitRaw > 0
            ? Math.min(limitRaw, MAX_PAGE_SIZE)
            : 10;

        const search = normalizeText(req.query.search);
        const offset = (page - 1) * limit;

        const searchLike = `%${search}%`;
        
        const [result, countResult] = await Promise.all([
            pool.query(
                'SELECT productos.*, categorias.nombre AS categoria FROM productos JOIN categorias ON productos.categoria_id = categorias.id WHERE productos.nombre ILIKE $1 LIMIT $2 OFFSET $3',
                [searchLike, limit, offset]
            ),
            pool.query(
                'SELECT COUNT(*)::int AS total FROM productos WHERE nombre ILIKE $1',
                [searchLike]
            )
        ]);

        return res.json({
            data: result.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0]?.total ?? 0
            }
        });
    } catch (err) {
                const message = err instanceof Error ? err.message : 'Error inesperado';
        return res.status(500).json({ error: message });
    }
});

const clients = [];

app.get('/api/notificacion-stock', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    clients.push(res);
    console.log(res)
    
    req.on('close', () => clients.splice(clients.indexOf(res), 1));
});

async function notifyOutOfStock(productId) {

    const product = await pool.query('SELECT * FROM productos WHERE id = $1', [productId]);
    if (product.rows.length === 0 || Number(product.rows[0].stock) > 0) {
        return;
    }

    clients.forEach(res =>
        res.write(`data: ${JSON.stringify({ ...product.rows[0], inStock: false })}\n\n`)
    );
}

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

export default app;
