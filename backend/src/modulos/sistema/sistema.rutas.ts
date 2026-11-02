import { z } from 'zod';
import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta } from '../../compartido/http/respuestas.js';
import { SOLO_ADMIN } from '../../compartido/http/tipos.js';
import { sistemaServicio } from './sistema.servicio.js';

/**
 * Rutas pequeñas que no justifican un controlador aparte: solo pasan la llamada al
 * servicio y envuelven la respuesta.
 */
export function rutasSalud(): Modulo {
  return new Modulo('/api/salud', 'Sistema').ruta({
    metodo: 'get',
    ruta: '/',
    resumen: 'Estado de la API y de la conexión a SQL Server',
    acceso: 'publico',
    manejador: async () => respuesta(await sistemaServicio.salud()),
  });
}

export function rutasCatalogosGenerales(): Modulo {
  return new Modulo('/api/catalogos', 'Catálogos generales')
    .ruta({
      metodo: 'get',
      ruta: '/departamentos',
      resumen: 'Departamentos de Guatemala (para las direcciones)',
      acceso: 'publico',
      manejador: async () => respuesta(await sistemaServicio.departamentos()),
    })
    .ruta({
      metodo: 'get',
      ruta: '/metodos-envio',
      resumen: 'Métodos de envío disponibles con su costo',
      acceso: 'publico',
      manejador: async () => respuesta(await sistemaServicio.metodosEnvio()),
    })
    .ruta({
      metodo: 'get',
      ruta: '/estados-pedido',
      resumen: 'Estados del pedido y a cuáles se puede pasar desde cada uno',
      acceso: 'publico',
      manejador: async () => respuesta(await sistemaServicio.estadosPedido()),
    });
}

export function rutasParametros(): Modulo {
  return new Modulo('/api/parametros', 'Sistema')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Parámetros configurables del sistema',
      descripcion: 'Duración de la reserva del checkout, horas para carrito abandonado y umbral de existencia baja.',
      acceso: SOLO_ADMIN,
      manejador: async () => respuesta(await sistemaServicio.parametros()),
    })
    .ruta({
      metodo: 'put',
      ruta: '/:clave',
      resumen: 'Cambiar el valor de un parámetro',
      acceso: SOLO_ADMIN,
      params: z.strictObject({ clave: z.string().regex(/^[A-Z_]{3,50}$/, 'Clave inválida') }),
      body: z.strictObject({ valor: z.number().int() }),
      manejador: async (ctx) =>
        respuesta(await sistemaServicio.actualizarParametro(usuarioDe(ctx).id, ctx.params.clave, ctx.body.valor)),
    });
}
