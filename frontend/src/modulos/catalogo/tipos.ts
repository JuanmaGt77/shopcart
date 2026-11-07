export interface Categoria {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  productosActivos: number;
}

/** Producto en el listado del catálogo (una tarjeta). */
export interface ProductoResumen {
  idProducto: number;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  idCategoria: number;
  categoria: string;
  activo: boolean;
  precioMinimo: number;
  precioMaximo: number;
  disponible: number;
  cantidadVariantes: number;
  imagenUrl: string | null;
  fechaCreacion: string;
}

export interface ImagenProducto {
  idProductoImagen?: number;
  url: string;
  textoAlternativo: string | null;
  orden: number;
}

export interface AtributoVariante {
  nombre: string;
  valor: string;
}

export interface Variante {
  idVariante: number;
  sku: string;
  precio: number;
  disponible: number;
  /** Solo para el personal */
  existencia?: number;
  reservada?: number;
  activo: boolean;
  /** "Color: Azul / Talla: L" */
  descripcionVariante: string | null;
  atributos: AtributoVariante[];
}

/** Producto con sus imágenes y variantes (GET /productos/:id). */
export interface ProductoDetalle {
  idProducto: number;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  idCategoria: number;
  categoria: string;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  precioMinimo: number;
  precioMaximo: number;
  disponible: number;
  imagenes: ImagenProducto[];
  variantes: Variante[];
}

export type OrdenProductos = 'recientes' | 'precio' | 'nombre';

export interface FiltrosProductos {
  q?: string | undefined;
  idCategoria?: number | undefined;
  precioMin?: number | undefined;
  precioMax?: number | undefined;
  disponible?: boolean | undefined;
  ordenarPor?: OrdenProductos | undefined;
  direccion?: 'asc' | 'desc' | undefined;
  incluirInactivos?: boolean | undefined;
  pagina?: number | undefined;
  tamanoPagina?: number | undefined;
}
