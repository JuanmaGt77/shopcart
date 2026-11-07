import { pedir } from '@/api/cliente';
import type { PedidoDetalle } from '@/modulos/pedidos/tipos';

export interface LineaCheckout {
  idVariante: number;
  sku: string;
  nombreProducto: string;
  descripcionVariante: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  descuento: number;
  total: number;
  disponible: number;
  imagenUrl: string | null;
}

/** Reserva de 15 minutos con precios y descuento congelados (SP_Checkout_Iniciar). */
export interface Checkout {
  idCheckout: number;
  idUsuario: number;
  estado: 'ACTIVO' | 'COMPLETADO' | 'EXPIRADO' | 'CANCELADO';
  fechaCreacion: string;
  fechaExpiracion: string;
  segundosRestantes: number;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
  baseImponible: number;
  montoIVA: number;
  codigoCupon: string | null;
  idMetodoEnvio: number;
  metodoEnvio: string;
  diasEstimadosMin: number;
  diasEstimadosMax: number;
  idDireccion: number;
  direccionAlias: string;
  destinatario: string;
  direccionTexto: string;
  idPedido: number | null;
  numeroPedido: string | null;
  lineas: LineaCheckout[];
}

export interface DatosTarjeta {
  numero: string;
  titular: string;
  expiracion: string;
  cvv: string;
}

export const apiCheckout = {
  iniciar: (idDireccion: number, idMetodoEnvio: number) =>
    pedir<Checkout>('/checkout', { metodo: 'POST', cuerpo: { idDireccion, idMetodoEnvio } }),

  obtener: (idCheckout: number, senal?: AbortSignal) => pedir<Checkout>(`/checkout/${idCheckout}`, { senal }),

  cancelar: (idCheckout: number) => pedir<unknown>(`/checkout/${idCheckout}`, { metodo: 'DELETE' }),

  /** La misma clave en un reintento devuelve el mismo pedido (duplicado = true), sin cobrar otra vez. */
  pagar: (idCheckout: number, tarjeta: DatosTarjeta, claveIdempotencia: string) =>
    pedir<{ pedido: PedidoDetalle; duplicado: boolean }>(`/checkout/${idCheckout}/pagar`, {
      metodo: 'POST',
      cuerpo: { tarjeta },
      encabezados: { 'Idempotency-Key': claveIdempotencia },
    }),
};
