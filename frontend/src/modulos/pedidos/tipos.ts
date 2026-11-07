import type { CodigoEstadoPedido } from './estados';

/** Pedido en un listado (mis pedidos o el panel). */
export interface PedidoResumen {
  idPedido: number;
  numeroPedido: string;
  estadoCodigo: CodigoEstadoPedido;
  estado: string;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  montoDevuelto: number;
  codigoCupon: string | null;
  metodoEnvioNombre: string;
  cantidadArticulos: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  // Solo en el listado del personal
  idUsuario?: number;
  cliente?: string;
  correoCliente?: string;
}

export interface LineaPedido {
  idPedidoDetalle: number;
  idVariante: number;
  sku: string;
  nombreProducto: string;
  descripcionVariante: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  descuento: number;
  total: number;
  cantidadDevuelta: number;
  montoDevuelto: number;
  cantidadDevolvible: number;
  disponibleActual: number;
  imagenUrl: string | null;
}

export interface CambioEstadoPedido {
  idPedidoHistorialEstado: number;
  estadoAnteriorCodigo: CodigoEstadoPedido | null;
  estadoAnterior: string | null;
  estadoNuevoCodigo: CodigoEstadoPedido;
  estadoNuevo: string;
  idUsuario: number | null;
  usuario: string | null;
  rolUsuario: string | null;
  comentario: string | null;
  fecha: string;
}

export interface PagoPedido {
  idPago: number;
  metodo: string;
  marcaTarjeta: string | null;
  ultimosDigitos: string | null;
  codigoAutorizacion: string | null;
  monto: number;
  montoReembolsado: number;
  estado: string;
  fechaPago: string;
}

export interface Devolucion {
  idDevolucion: number;
  motivo: string;
  montoReembolso: number;
  fecha?: string;
  fechaCreacion?: string;
  usuario?: string | null;
  lineas?: {
    idPedidoDetalle: number;
    sku?: string;
    nombreProducto?: string;
    cantidad: number;
    monto?: number;
  }[];
}

export interface PedidoDetalle {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  cliente: string;
  correoCliente: string;
  estadoCodigo: CodigoEstadoPedido;
  estado: string;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  baseImponible: number;
  montoIVA: number;
  montoDevuelto: number;
  codigoCupon: string | null;
  metodoEnvioNombre: string;
  entregaDestinatario: string;
  entregaTelefono: string;
  entregaDireccion: string;
  cantidadArticulos: number;
  idCheckout: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  lineas: LineaPedido[];
  historial: CambioEstadoPedido[];
  pago: PagoPedido | null;
  devoluciones: Devolucion[];
}
