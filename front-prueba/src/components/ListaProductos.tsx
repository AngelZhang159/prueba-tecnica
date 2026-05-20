import { useEffect, useState } from "react";
import { BASE_URL } from "../services/api";
import { getProductos } from "../services/api_productos";
import type { PaginatedResponse } from "../types/pag_res";
import type { Producto } from "../types/productos.ts";

function ListaProductos({ query }: { query: string }) {
    const [productos, setProductos] = useState<PaginatedResponse<Producto> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debouncedQuery, setDebouncedQuery] = useState(query);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedQuery(query);
            setPage(1);
        }, 300);

        return () => {
            clearTimeout(handle);
        };
    }, [query]);

    useEffect(() => {
        let isActive = true;

        setLoading(true);
        setError(null);

        getProductos({ search: debouncedQuery, page, limit })
            .then((res) => {
                if (!isActive) return;
                setProductos(res);
            })
            .catch((err) => {
                if (!isActive) return;
                const message = err instanceof Error ? err.message : "Error cargando productos";
                setError(message);
                setProductos(null);
            })
            .finally(() => {
                if (!isActive) return;
                setLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [debouncedQuery, page, limit]);

    useEffect(() => {
        const source = new EventSource(`${BASE_URL}/api/notificacion-stock`, {
            withCredentials: true,
        });

        source.onmessage = (event) => {
            let payload: { id?: number; stock?: number } | null = null;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }

            const productId = Number(payload?.id);
            if (!Number.isFinite(productId)) {
                return;
            }

            const nextStock = typeof payload?.stock === "number" ? payload.stock : 0;

            setProductos((current) => {
                if (!current) return current;

                let updated = false;
                const nextData = current.data.map((producto) => {
                    if (producto.id !== productId) return producto;
                    if (producto.stock === nextStock) return producto;
                    updated = true;
                    return { ...producto, stock: nextStock };
                });

                return updated ? { ...current, data: nextData } : current;
            });
        };

        source.onerror = () => {
            source.close();
        };

        return () => {
            source.close();
        };
    }, []);

    return (
        <div>
            <div className="flex justify-between items-center p-6">
                <h2 className='font-bold text-3xl'>Productos</h2>
                <select className="border border-gray-300 rounded-md p-2" name="paginacion" id="paginacion" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                </select>
            </div>
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-40 rounded-md bg-neutral-950 animate-pulse"
                        ></div>
                    ))}
                </div>
            )}
            {error && (
                <p className="px-6 text-red-600">{error}</p>
            )}
            {!loading && !error && productos && productos.data.length === 0 && (
                <p className="px-6">Sin productos</p>
            )}
            {!loading && !error && productos && productos.data.length > 0 && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
                        {productos.data.map((producto) => {
                            const isOutOfStock = producto.stock === 0;

                            return (
                                <div
                                    key={producto.id}
                                    className={`border border-gray-300 rounded-md p-4 ${
                                        isOutOfStock ? "opacity-50 grayscale" : ""
                                    }`}
                                    aria-disabled={isOutOfStock}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-xl">{producto.nombre}</h3>
                                        {isOutOfStock && (
                                            <span className="text-xs uppercase tracking-wide text-red-400">
                                                Sin stock
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-600">{producto.categoria}</p>
                                    <p className={isOutOfStock ? "text-gray-400 font-bold" : "text-white font-bold"}>
                                        ${producto.precio}
                                    </p>
                                    <p className="text-gray-600">Stock: {producto.stock}</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-center gap-6 items-center p-6">
                        <button
                            className="bg-transparent text-white px-4 py-2 rounded-md disabled:text-neutral-400 disabled:bg-neutral-700 disabled:cursor-not-allowed hover:cursor-pointer border-white border hover:bg-white hover:text-black transition-colors"
                            onClick={() => setPage((p) => Math.max(p - 1, 1))}
                            disabled={page === 1 || loading}
                        >
                            Anterior
                        </button>
                        <span>Página {page}</span>
                        <button
                            className="bg-transparent text-white px-4 py-2 rounded-md disabled:text-neutral-400 disabled:bg-neutral-700 disabled:cursor-not-allowed hover:cursor-pointer border-white border hover:bg-white hover:text-black transition-colors"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={loading || (productos ? page >= Math.ceil(productos.pagination.total / limit) : false)}
                        >
                            Siguiente
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

export default ListaProductos