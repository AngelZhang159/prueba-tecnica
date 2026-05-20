import { get } from './api';
import type { Producto, ProductoSearchParams } from '../types/productos.ts';
import type { PaginatedResponse } from '../types/pag_res';

export const getProductos: (params: ProductoSearchParams) => Promise<PaginatedResponse<Producto>> = (params) => {
    const query = new URLSearchParams(params as Record<string, string>);
    return get(`/api/productos?${query}`);
};