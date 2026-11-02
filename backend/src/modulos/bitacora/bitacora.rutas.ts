import { Modulo } from '../../compartido/http/modulo.js';
import { respuesta, respuestaPaginada } from '../../compartido/http/respuestas.js';
import { SOLO_ADMIN } from '../../compartido/http/tipos.js';
import { filtroBitacoraEsquema } from './bitacora.esquemas.js';
import { bitacoraServicio } from './bitacora.servicio.js';

/** Solo lectura: no existe ninguna ruta (ni SP) para modificar o borrar la bitácora. */
export function rutasBitacora(): Modulo {
  return new Modulo('/api/bitacora', 'Bitácora')
    .ruta({
      metodo: 'get',
      ruta: '/',
      resumen: 'Consultar la bitácora con filtro por módulo',
      descripcion:
        'Cada registro tiene usuario, fecha y hora, entidad, acción, valor anterior y valor nuevo. Se llena con triggers y no se puede modificar ni eliminar.',
      acceso: SOLO_ADMIN,
      query: filtroBitacoraEsquema,
      manejador: async ({ query }) => respuestaPaginada(await bitacoraServicio.listar(query)),
    })
    .ruta({
      metodo: 'get',
      ruta: '/modulos',
      resumen: 'Cuántos registros tiene cada módulo',
      acceso: SOLO_ADMIN,
      manejador: async () => respuesta(await bitacoraServicio.resumenModulos()),
    });
}
