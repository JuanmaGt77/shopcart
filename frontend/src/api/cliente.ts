/**
 * Cliente HTTP de la API. Todas las rutas son relativas (/api/...): en desarrollo las reenvía
 * el proxy de Vite y en Docker el nginx del frontend, así que el navegador nunca sale de su origen.
 *
 * La API siempre responde con el mismo formato:
 *   éxito   -> { datos } o { datos, paginacion }
 *   error   -> { error: { codigo, mensaje, detalles?, idSolicitud } }
 */

export interface Paginacion {
  pagina: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

export interface RespuestaPaginada<T> {
  datos: T[];
  paginacion: Paginacion;
}

interface CuerpoError {
  error?: { codigo?: string; mensaje?: string; detalles?: unknown; idSolicitud?: string };
}

/** Error de la API con el código de negocio que manda el backend (STOCK_INSUFICIENTE, CUPON_VENCIDO...). */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly detalles: unknown;
  readonly idSolicitud: string | undefined;

  constructor(estado: number, codigo: string, mensaje: string, detalles?: unknown, idSolicitud?: string) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
    this.idSolicitud = idSolicitud;
  }
}

async function leerError(respuesta: Response): Promise<ErrorApi> {
  const cuerpo = (await respuesta.json().catch(() => ({}))) as CuerpoError;
  return new ErrorApi(
    respuesta.status,
    cuerpo.error?.codigo ?? 'ERROR_DESCONOCIDO',
    cuerpo.error?.mensaje ?? 'No se pudo completar la solicitud. Intenta de nuevo.',
    cuerpo.error?.detalles,
    cuerpo.error?.idSolicitud,
  );
}

/** GET sin sesión que devuelve `datos`. La versión con token y renovación llega con el módulo de autenticación. */
export async function obtenerPublico<T>(ruta: string, senal?: AbortSignal): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, {
    signal: senal ?? null,
    headers: { Accept: 'application/json' },
  });
  if (!respuesta.ok) throw await leerError(respuesta);
  const cuerpo = (await respuesta.json()) as { datos: T };
  return cuerpo.datos;
}
