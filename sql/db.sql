CREATE DATABASE prueba_angel;

CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id),
    precio DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL,
    cod_producto VARCHAR(50) UNIQUE NOT NULL,
    CONSTRAINT chk_stock CHECK (stock >= 0)
);

CREATE INDEX idx_productos_categoria_id ON productos(categoria_id);


CREATE TABLE historial_stock (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id),
    cantidad INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_historial_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_historial_tipo CHECK (tipo IN ('entrada', 'salida'))
);

INSERT INTO categorias (nombre) VALUES ('Electrónica'), ('Ropa'), ('Alimentos');
INSERT INTO productos (nombre, categoria_id, precio, stock, cod_producto) VALUES 
('Smartphone', 1, 699.99, 50, 'ELEC001'),
('Laptop', 1, 999.99, 30, 'ELEC002'),
('Camiseta', 2, 19.99, 100, 'ROPA001'),
('Pantalones', 2, 39.99, 80, 'ROPA002'),
('Manzanas', 3, 0.99, 200, 'ALIM001'),
('Pan', 3, 1.99, 150, 'ALIM002');

--more products
INSERT INTO productos (nombre, categoria_id, precio, stock, cod_producto) VALUES 
('Tablet', 1, 499.99, 20, 'ELEC003'),
('Auriculares', 1, 199.99, 40, 'ELEC004'),
('Chaqueta', 2, 59.99, 60, 'ROPA003'),
('Zapatos', 2, 89.99, 70, 'ROPA004'),
('Leche', 3, 0.89, 300, 'ALIM003'),
('Huevos', 3, 2.99, 250, 'ALIM004'),
('Cámara', 1, 299.99, 15, 'ELEC005'),
('Monitor', 1, 199.99, 25, 'ELEC006'),
('Vestido', 2, 49.99, 40, 'ROPA005'),
('Falda', 2, 29.99, 50, 'ROPA006'),
('Arroz', 3, 0.79, 400, 'ALIM005'),
('Frijoles', 3, 1.49, 350, 'ALIM006');

INSERT INTO historial_stock (producto_id, cantidad, tipo) VALUES 
(1, 50, 'entrada'),
(2, 30, 'entrada'),
(3, 100, 'entrada'),
(4, 80, 'entrada'),
(5, 200, 'entrada'),
(6, 150, 'entrada'),
(7, 15, 'entrada'),
(8, 25, 'entrada'),
(9, 40, 'entrada'),
(10, 50, 'entrada'),
(11, 400, 'entrada'),
(12, 350, 'entrada'),
(1, 5, 'salida'),
(2, 3, 'salida'),
(3, 10, 'salida'),
(4, 8, 'salida'),
(5, 20, 'salida'),
(6, 15, 'salida'),
(7, 2, 'salida'),
(8, 5, 'salida'),
(9, 4, 'salida'),
(10, 6, 'salida'),
(11, 30, 'salida'),
(12, 25, 'salida');
