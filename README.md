# Desarrollo de una funcionalidad mínima 

- [x] Modelo de Datos:
  - [x] Diseña una estructura de tablas para productos, categorías e historial_stock.
  - [x] Garantía de Integridad: Configura restricciones (constraints) a nivel de base de datos para evitar stocks negativos y asegurar que los códigos de producto sean únicos.
  - [x] Rendimiento: Escribe una consulta indexada u optimizada que devuelva el inventario valorado por categoría, preparada para soportar un volumen masivo de registros sin penalizar el tiempo de respuesta.

- [x] API de Control, Seguridad y Flujos
  - [x] Transaccionalidad: Implementa un endpoint POST /api/movimientos para registrar entradas/salidas de stock. Esta operación debe usar una transacción SQL (si falla la inserción en el historial, se debe hacer rollback y no modificar el stock del producto).
  - [x] Control de Conexiones: Configura el acceso a la base de datos mediante un Connection Pool, limitando el número máximo de conexiones y controlando los tiempos de inactividad (idle timeout).
  - [x] Seguridad: Asegura los endpoints contra SQL Injection usando consultas parametrizadas u ORM, y configura correctamente las políticas de CORS para producción.

- [x] Interfaz Dinámica y Optimización (React)
  - [x] Consumo y Rendimiento: Crea una vista que liste los productos. Implementa paginación desde el servidor o virtualización de contenido en el frontend para evitar el colapso del DOM.
  - [x] Optimización de Búsqueda: Implementa un buscador en tiempo real. Es necesario aplicar la técnica de Debounce (esperar un margen de tiempo tras la última pulsación) antes de disparar la petición HTTP al backend.
  - [x] Sincronización: Cuando un producto se quede sin stock, la interfaz debe reflejarlo visualmente de inmediato. Puedes simular esto mediante WebSockets o documentar en el README cómo estructurarías el flujo para mantener al usuario actualizado sin recargar la página.

### Para la sincronización de stock, he usado **SSE** en vez de **WebSockets** para mejorar la eficiencia porque la notificación de productos agotados es unidireccional (solamente el servidor manda datos al cliente) y no es necesaria la conexión bidireccional del WebSocket.

---

# Ejercicio de análisis de código

### 1. Gestión de Venta y Descuento de Stock
 ``` javascript
    const { Pool } = require('pg');
    const pool = new Pool();

    async function procesarCompra(req, res) {
        const { productoId, cantidad, usuarioId } = req.body;

        try {
            // 1. Validar si hay stock suficiente
            const resStock = await pool.query(
                'SELECT stock FROM productos WHERE id = $1',
                [productoId]
            );

            if (resStock.rows[0].stock < cantidad) {
                return res.status(400).json({ error: 'Stock insuficiente' });
            }

            // 2. Descontar el stock
            await pool.query(
                'UPDATE productos SET stock = stock - $1 WHERE id = $2',
                [cantidad, productoId]
            );

            // 3. Registrar la orden
            await pool.query(
                'INSERT INTO ordenes (usuario_id, producto_id, cantidad) VALUES ($1, $2, $3)',
                [usuarioId, productoId, cantidad]
            );

            return res.status(201).json({ mensaje: 'Compra procesada con éxito' });

        } catch (error) {
            console.error('Error en la transacción:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
```

Esta función puede tener un problema de race condition porque al ejecutar las queries SQL una detrás de otra.

Al ser async, pueden haber varias llamadas a esta función simultaneas que modifiquen los mismos datos a la vez, por ejemplo, un producto tiene stock de 5, llegan dos peticiones con el mismo producto_id, uno con una orden de 3 y otra con una orden de 4, los dos pueden ejecutar el SELECT a la vez y devolver que hay 5, por lo que pasarán el primer **if** de comprobación y en cuanto uno lleguen al UPDATE del stock, los dos intentarán restarlo (dependiendo de si la BBDD valida valores de stock negativos o no) y el stock puede quedar en -1.

Para evitar esto, habría que realizar todas las queries en una transacción SQL para que se ejecuten todas a la vez y solo cuando cumplen las condiciones. Además habría que poner una constraint a nivel de BBDD para que no haya stock negativo si no la hubiese.

### 2. El Bucle Asíncrono Bloqueante

``` javascript

async function generarReportesMasivos(req, res) {
    const { usuariosIds } = req.body; // Array con ~5,000 IDs de usuarios

    try {
        for (const id of usuariosIds) {
            const datos = await pool.query('SELECT * FROM metricas_usuario WHERE usuario_id = $1', [id]);

            // Operación pesada de CPU: Encriptación y parsing de JSON complejo
            const reporteFormateado = transformarYEncriptarMetricas(datos.rows);

            await pool.query('UPDATE reportes SET data = $1 WHERE usuario_id = $2', [reporteFormateado, id]);
        }

        return res.status(200).json({ mensaje: 'Todos los reportes han sido procesados' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
``` 

El problema de esta función es que como puede llegar un array tan grande, para cada item del array, se ejecutan 2 queries SQL y una función pesada.

Esto puede causar un timeout para el cliente que haya hecho la petición HTTP porque pasa demasiado tiempo ejecutando la petición.

Para arreglarlo, en vez de esperar a que se ejecute todo para enviar la respuesta, se podría poner en una cola de trabajo y responder directamente al cliente que se ha recibido la petición y se está procesando y mandar al cliente otro endpoint para ver el estado de la cola donde haga polling a un endpoint, use SSE o WebSockets para recibir nuevas actualizaciones o algun otro método como mandar un email o notificaciones push.

La cola de trabajo podría ejecutarse en el mismo servidor o, como es una operación pesada, mandarla a otro microservicio dedicado para que lo procese en trozos con comprobación de errores/retry automático.

### 3. Fuga de Memoria en Panel de Tiempo Real

``` jsx

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function PanelInventarioTiempoReal() {
    const [productos, setProductos] = useState([]);

    useEffect(() => {
        const socket = io('https://api.miempresa.com');

        socket.on('actualizacion_inventario', (data) => {
            setProductos(data);
        });

        fetch('/api/productos')
            .then(res => res.json())
            .then(data => setProductos(data));

    }, []);

    return (
        <div>
            {productos.map(p => <p key={p.id}>{p.nombre}: {p.stock}</p>)}
        </div>
    );
}
```

Este componente usa un WebSocket para mostrar actualizaciones en el inventario pero, cada vez que recibe un nuevo dato y hace el setProductos con los nuevos datos, se hace rerender del componente pero no limpia el socket por lo que cada vez de hay una nueva actualización abre otro nuevo y se van acumulando cada vez, lo que malgasta recursos.

### 4. El Problema de Consulta N+1

``` javascript
async function obtenerCatalogo(req, res) {
    try {
        // 1. Obtener todos los productos activos
        const productosRes = await pool.query(
            'SELECT id, nombre, categoria_id FROM productos WHERE activo = true'
        );
        const productos = productosRes.rows;

        // 2. Buscar la información de la categoría para cada producto
        for (let producto of productos) {
            const categoriaRes = await pool.query(
                'SELECT nombre_categoria, impuesto FROM categorias WHERE id = $1',
                [producto.categoria_id]
            );
            producto.categoria = categoriaRes.rows[0];
        }

        return res.status(200).json(productos);
    } catch (error) {
        return res.status(500).json({ error: 'Fallo al cargar catálogo' });
    }
}
```

En esta función, al recibir la peticion, por cada producto activo que encuentre en la BBDD, va a hacer una petición para añadir el nombre e impuesto buscando el la tabla categorias. Por lo que si hay 9000 productos activos, hará otras 9000 queries extra para recoger la info que falta.

Para evitar esto se debería hacer un JOIN con la tabla categorías directamente en el primer SELECT y evitar todos las otras peticiones extra. Y además se podría añadir un índice en categoria_id para mejorar la eficiencia.