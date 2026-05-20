export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  categoria_id: number;
  categoria: string; // joined field from your SQL
}

export interface ProductoSearchParams {
  search?: string;
  page?: number;
  limit?: number;
}