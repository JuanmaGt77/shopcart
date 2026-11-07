/** Estados del pedido (tabla EstadoPedido) y cómo se muestran. */
export const ESTADOS_PEDIDO = [
  'PAGADO',
  'EN_PREPARACION',
  'DESPACHADO',
  'ENTREGADO',
  'DEVUELTO_PARCIAL',
  'DEVUELTO',
  'CANCELADO',
] as const;

export type CodigoEstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const NOMBRE_ESTADO_PEDIDO: Record<CodigoEstadoPedido, string> = {
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  DEVUELTO_PARCIAL: 'Devuelto parcialmente',
  DEVUELTO: 'Devuelto',
  CANCELADO: 'Cancelado',
};

/** Clases de color de la insignia de cada estado. */
export const COLOR_ESTADO_PEDIDO: Record<CodigoEstadoPedido, string> = {
  PAGADO: 'bg-primary/10 text-primary',
  EN_PREPARACION: 'bg-advertencia/15 text-amber-700 dark:text-amber-300',
  DESPACHADO: 'bg-chart-3/15 text-sky-700 dark:text-sky-300',
  ENTREGADO: 'bg-exito/15 text-exito',
  DEVUELTO_PARCIAL: 'bg-muted text-muted-foreground',
  DEVUELTO: 'bg-muted text-muted-foreground',
  CANCELADO: 'bg-destructive/10 text-destructive',
};

/** El cliente puede cancelar mientras no se haya despachado. */
export const esCancelable = (estado: CodigoEstadoPedido) =>
  estado === 'PAGADO' || estado === 'EN_PREPARACION';
