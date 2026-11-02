import { z } from 'zod';
import { fechaDia, idPositivo, paginacion, rangoValido, textoOpcional } from '../../compartido/esquemas.js';
import { ESTADOS } from './maquina-estados.js';

export const misPedidosEsquema = z.strictObject({
  estado: z.enum(ESTADOS).optional(),
  ...paginacion,
});

export const listarPedidosEsquema = z
  .strictObject({
    estado: z.enum(ESTADOS).optional(),
    cliente: z.string().trim().max(100).optional(),
    idCliente: idPositivo.optional(),
    desde: fechaDia.optional(),
    hasta: fechaDia.optional(),
    ordenarPor: z.enum(['fecha', 'total', 'numero']).default('fecha'),
    direccion: z.enum(['asc', 'desc']).default('desc'),
    ...paginacion,
  })
  .refine(rangoValido, { message: 'La fecha inicial no puede ser mayor que la final', path: ['desde'] });

export const cambiarEstadoEsquema = z.strictObject({
  estado: z.enum(['EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'], {
    message: 'Con esta operación solo se avanza a EN_PREPARACION, DESPACHADO o ENTREGADO',
  }),
  comentario: textoOpcional(250),
});

export const cancelarEsquema = z.strictObject({
  motivo: z.string().trim().min(3, 'Indica el motivo de la cancelación').max(250),
});

export const devolucionEsquema = z.strictObject({
  motivo: z.string().trim().min(3, 'Indica el motivo de la devolución').max(250),
  lineas: z
    .array(
      z.strictObject({
        idPedidoDetalle: idPositivo,
        cantidad: z.number().int().positive('La cantidad a devolver debe ser mayor a cero'),
      }),
    )
    .min(1, 'Indica al menos una línea a devolver')
    .refine((l) => new Set(l.map((x) => x.idPedidoDetalle)).size === l.length, 'Hay líneas repetidas'),
});

export type FiltroMisPedidos = z.infer<typeof misPedidosEsquema>;
export type FiltroPedidos = z.infer<typeof listarPedidosEsquema>;
export type DatosDevolucion = z.infer<typeof devolucionEsquema>;
