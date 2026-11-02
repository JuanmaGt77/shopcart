import { EventEmitter } from 'node:events';

/**
 * Eventos de dominio. Los servicios los publican DESPUÉS de que el SP confirmó la
 * transacción, así nadie se entera de algo que al final se revirtió.
 * Quién escucha:
 *   - realtime/servidor.ts los reenvía por WebSocket a las salas que corresponden.
 *   - reportes invalida su caché cuando cambian las ventas.
 * Así los servicios no dependen de Socket.IO ni de la caché.
 */
export interface ExistenciaVariante {
  idVariante: number;
  idProducto?: number;
  sku: string;
  disponible: number;
}

export interface PedidoCreado {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  cliente: string;
  total: number;
}

export interface CambioEstadoPedido {
  idPedido: number;
  numeroPedido: string;
  idUsuario: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
}

export interface CambioCatalogo {
  entidad: 'producto' | 'variante' | 'categoria';
  id: number;
  accion: string;
}

export interface CambioCarrito {
  idUsuario: number;
  cantidadArticulos: number;
  total: number;
}

interface MapaEventos {
  'pedido:creado': [PedidoCreado];
  'pedido:estado': [CambioEstadoPedido];
  'ventas:cambiaron': [{ motivo: string }];
  'inventario:cambio': [ExistenciaVariante[]];
  'catalogo:cambio': [CambioCatalogo];
  'carrito:cambio': [CambioCarrito];
  'checkout:expirado': [{ idUsuario: number; idCheckout: number }];
  'sesion:revocada': [{ idUsuario: number }];
}

export const eventosDominio = new EventEmitter<MapaEventos>();
eventosDominio.setMaxListeners(50);
