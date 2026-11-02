import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { respuesta, respuestaPaginada } from '../../compartido/http/respuestas.js';
import { PERSONAL } from '../../compartido/http/tipos.js';
import { conciliacionEsquema, existenciasEsquema, kardexEsquema, movimientoEsquema } from './inventario.esquemas.js';
import { inventarioServicio } from './inventario.servicio.js';

export function rutasInventario(): Modulo {
  return new Modulo('/api/inventario', 'Inventario')
    .ruta({
      metodo: 'get',
      ruta: '/existencias',
      resumen: 'Existencia física, reservada y disponible por variante',
      acceso: PERSONAL,
      query: existenciasEsquema,
      manejador: async ({ query }) => respuestaPaginada(await inventarioServicio.existencias(query)),
    })
    .ruta({
      metodo: 'post',
      ruta: '/movimientos',
      resumen: 'Registrar una entrada por compra o un ajuste',
      descripcion:
        'El motivo es obligatorio. Un ajuste no puede dejar la existencia en negativo ni por debajo de lo reservado en checkouts activos. Queda en el kardex con usuario, fecha, motivo y cantidad.',
      acceso: PERSONAL,
      body: movimientoEsquema,
      estado: 201,
      manejador: async (ctx) => respuesta(await inventarioServicio.registrarMovimiento(usuarioDe(ctx).id, ctx.body)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/kardex',
      resumen: 'Historial de movimientos (kardex)',
      acceso: PERSONAL,
      query: kardexEsquema,
      manejador: async ({ query }) => respuestaPaginada(await inventarioServicio.kardex(query)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/conciliacion',
      resumen: 'Comprobar que la existencia coincide con la suma del kardex',
      descripcion: 'Con soloDiferencias=true (por defecto) solo lista las variantes que no cuadran; lo normal es que no haya ninguna.',
      acceso: PERSONAL,
      query: conciliacionEsquema,
      manejador: async ({ query }) => respuesta(await inventarioServicio.conciliacion(query.soloDiferencias)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/tipos-movimiento',
      resumen: 'Tipos de movimiento del kardex',
      acceso: PERSONAL,
      manejador: async () => respuesta(await inventarioServicio.tiposMovimiento()),
    });
}
