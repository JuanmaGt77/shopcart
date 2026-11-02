import { ErrorAplicacion, ErrorNoEncontrado } from '../../compartido/errores.js';
import { CacheTTL } from '../../compartido/cache.js';
import { sistemaRepositorio } from './sistema.repositorio.js';

// Catálogos que casi nunca cambian: se guardan 10 minutos para no consultarlos en cada visita
const cacheCatalogos = new CacheTTL<unknown>(10 * 60 * 1000);

async function conCache<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  const enCache = cacheCatalogos.obtener(clave) as T | undefined;
  if (enCache !== undefined) return enCache;
  const valor = await cargar();
  cacheCatalogos.guardar(clave, valor);
  return valor;
}

export const sistemaServicio = {
  async salud() {
    try {
      const resultado = await sistemaRepositorio.salud();
      return { api: 'OK', baseDatos: resultado?.estado ?? 'SIN_RESPUESTA', fechaServidor: resultado?.fechaServidorUtc };
    } catch {
      throw new ErrorAplicacion(503, 'BASE_DATOS_NO_DISPONIBLE', 'La API está arriba pero no puede conectarse a SQL Server.');
    }
  },

  departamentos: () => conCache('departamentos', sistemaRepositorio.departamentos),
  metodosEnvio: () => conCache('metodos-envio', sistemaRepositorio.metodosEnvio),
  estadosPedido: () => conCache('estados-pedido', sistemaRepositorio.estadosPedido),

  parametros: () => sistemaRepositorio.parametros(),

  async actualizarParametro(idUsuario: number, clave: string, valor: number) {
    const parametro = await sistemaRepositorio.actualizarParametro(idUsuario, clave, valor);
    if (!parametro) throw new ErrorNoEncontrado('El parámetro no existe.', 'PARAMETRO_NO_ENCONTRADO');
    return parametro;
  },
};
