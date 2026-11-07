/**
 * Cliente HTTP de la API. Todas las rutas son relativas (/api/...): en desarrollo las reenvía
 * el proxy de Vite y en Docker el nginx del frontend, así que el navegador nunca sale de su origen.
 *
 * La API siempre responde con el mismo formato:
 *   éxito   -> { datos } o { datos, paginacion }
 *   error   -> { error: { codigo, mensaje, detalles?, idSolicitud } }
 *
 * Si una petición con sesión recibe 401 porque el access token venció, se renueva el token
 * (una sola vez aunque fallen varias peticiones a la vez) y se repite la petición original.
 */
import { almacenSesion, renovarSesion } from '@/modulos/auth/almacen-sesion';

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

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
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

  /** Errores de validación por campo (400 VALIDACION): [{ campo, mensaje }] */
  get erroresDeCampo(): DetalleValidacion[] {
    if (!Array.isArray(this.detalles)) return [];
    return this.detalles.filter(
      (d): d is DetalleValidacion =>
        typeof d === 'object' && d !== null && 'campo' in d && 'mensaje' in d && typeof d.campo === 'string',
    );
  }
}

type ValorConsulta = string | number | boolean | null | undefined;

export interface OpcionesSolicitud {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  consulta?: Record<string, ValorConsulta>;
  encabezados?: Record<string, string>;
  senal?: AbortSignal;
}

/** Códigos 401 que se arreglan pidiendo un access token nuevo con el refresh token. */
const CODIGOS_RENOVABLES = new Set(['TOKEN_EXPIRADO', 'TOKEN_INVALIDO']);

function construirUrl(ruta: string, consulta?: Record<string, ValorConsulta>): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') parametros.set(clave, String(valor));
  }
  const texto = parametros.toString();
  return `/api${ruta}${texto ? `?${texto}` : ''}`;
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

async function ejecutar(ruta: string, opciones: OpcionesSolicitud, esReintento = false): Promise<Response> {
  const encabezados = new Headers({ Accept: 'application/json', ...opciones.encabezados });
  if (opciones.cuerpo !== undefined) encabezados.set('Content-Type', 'application/json');
  const token = almacenSesion.token();
  if (token) encabezados.set('Authorization', `Bearer ${token}`);

  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, opciones.consulta), {
      method: opciones.metodo ?? 'GET',
      headers: encabezados,
      body: opciones.cuerpo === undefined ? null : JSON.stringify(opciones.cuerpo),
      signal: opciones.senal ?? null,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ErrorApi(
      0,
      'SIN_CONEXION',
      'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.',
    );
  }

  if (respuesta.status === 401 && token && !esReintento) {
    const error = await leerError(respuesta.clone());
    if (CODIGOS_RENOVABLES.has(error.codigo) && (await renovarSesion())) {
      return ejecutar(ruta, opciones, true);
    }
    // Sesión revocada (cuenta desactivada) o refresh vencido: se cierra la sesión en el navegador
    almacenSesion.limpiar(error.codigo === 'SESION_REVOCADA' ? 'revocada' : 'expirada');
  }
  return respuesta;
}

async function solicitarCuerpo<C>(ruta: string, opciones: OpcionesSolicitud): Promise<C> {
  const respuesta = await ejecutar(ruta, opciones);
  if (!respuesta.ok) throw await leerError(respuesta);
  if (respuesta.status === 204) return undefined as C;
  return (await respuesta.json()) as C;
}

/** Llama la API y devuelve `datos`. */
export async function pedir<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<T> {
  const cuerpo = await solicitarCuerpo<{ datos: T } | undefined>(ruta, opciones);
  return cuerpo?.datos as T;
}

/** Llama un listado paginado del servidor y devuelve `{ datos, paginacion }`. */
export function pedirPaginado<T>(
  ruta: string,
  opciones: OpcionesSolicitud = {},
): Promise<RespuestaPaginada<T>> {
  return solicitarCuerpo<RespuestaPaginada<T>>(ruta, opciones);
}
