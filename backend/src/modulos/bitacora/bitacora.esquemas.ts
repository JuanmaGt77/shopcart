import { z } from 'zod';
import { idPositivo, paginacion } from '../../compartido/esquemas.js';

export const filtroBitacoraEsquema = z
  .strictObject({
    modulo: z.enum(['CATALOGO', 'INVENTARIO', 'CUPONES', 'PEDIDOS', 'USUARIOS', 'SISTEMA']).optional(),
    entidad: z.string().trim().max(40).optional(),
    idEntidad: z.string().trim().max(40).optional(),
    accion: z
      .enum(['CREAR', 'MODIFICAR', 'ACTIVAR', 'DESACTIVAR', 'ELIMINAR', 'CAMBIO_PRECIO', 'CAMBIO_EXISTENCIA', 'CAMBIO_ESTADO'])
      .optional(),
    idUsuario: idPositivo.optional(),
    desde: z.iso.datetime({ offset: true }).optional(),
    hasta: z.iso.datetime({ offset: true }).optional(),
    ...paginacion,
  })
  .refine((f) => !f.desde || !f.hasta || new Date(f.desde) <= new Date(f.hasta), {
    message: 'La fecha inicial no puede ser mayor que la final',
    path: ['desde'],
  });

export type FiltroBitacora = z.infer<typeof filtroBitacoraEsquema>;
