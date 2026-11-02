import { setTimeout as esperar } from 'node:timers/promises';
import { obtenerPool } from './conexion.js';
import { esDeadlock, traducirErrorBD } from './errores-bd.js';
import { SP_PERMITIDOS, type NombreSP } from './procedimientos.js';
import type { ParametroSP } from './parametros.js';

export type Fila = Record<string, unknown>;

export interface Paginacion {
  pagina: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

export interface ResultadoPaginado<T> {
  items: T[];
  paginacion: Paginacion;
}

const REINTENTOS_DEADLOCK = 3;

// Columnas DATE que se devuelven como 'AAAA-MM-DD' en lugar de fecha con hora
const COLUMNAS_SOLO_FECHA = new Set(['Periodo', 'Desde', 'Hasta', 'FechaLocal']);

/** 'IDProducto' -> 'idProducto', 'SKU' -> 'sku', 'NombreProducto' -> 'nombreProducto' */
function aCamelCase(columna: string): string {
  if (/^ID[A-Z]/.test(columna)) return 'id' + columna.slice(2);
  if (columna === columna.toUpperCase()) return columna.toLowerCase();
  return columna.charAt(0).toLowerCase() + columna.slice(1);
}

function normalizarFila(fila: Fila): Fila {
  const resultado: Fila = {};
  for (const [columna, valor] of Object.entries(fila)) {
    let normalizado = valor;
    if (valor instanceof Date && COLUMNAS_SOLO_FECHA.has(columna)) {
      normalizado = valor.toISOString().slice(0, 10);
    } else if (typeof valor === 'string' && columna.startsWith('ID') && /^\d+$/.test(valor)) {
      // Las llaves BIGINT llegan como texto; se devuelven como número para que todas las llaves sean iguales
      normalizado = Number(valor);
    }
    resultado[aCamelCase(columna)] = normalizado;
  }
  return resultado;
}

/**
 * Único punto de la API que habla con SQL Server. Ejecuta un SP por nombre (llamada
 * RPC, no texto SQL) con parámetros tipados y devuelve todos sus resultados.
 * Si SQL Server elige esta transacción como víctima de un deadlock se reintenta:
 * es seguro porque cada SP es atómico (o se aplicó completo o no se aplicó nada).
 */
export async function ejecutarSP(nombre: NombreSP, parametros: ParametroSP[] = []): Promise<Fila[][]> {
  if (!SP_PERMITIDOS.has(nombre)) {
    throw new Error(`Procedimiento no permitido: ${nombre}`);
  }

  for (let intento = 1; ; intento++) {
    try {
      const pool = await obtenerPool();
      const solicitud = pool.request();
      for (const parametro of parametros) {
        if ('tabla' in parametro) solicitud.input(parametro.nombre, parametro.tabla);
        else solicitud.input(parametro.nombre, parametro.tipo, parametro.valor);
      }
      const resultado = await solicitud.execute(nombre);
      const conjuntos = (resultado.recordsets ?? []) as unknown as Fila[][];
      return conjuntos.map((conjunto) => conjunto.map(normalizarFila));
    } catch (error) {
      if (esDeadlock(error) && intento < REINTENTOS_DEADLOCK) {
        await esperar(40 * intento + Math.floor(Math.random() * 60));
        continue;
      }
      throw traducirErrorBD(error) ?? error;
    }
  }
}

/** Primera fila del primer resultado (o null). */
export async function consultarUno<T>(nombre: NombreSP, parametros: ParametroSP[] = []): Promise<T | null> {
  const [primero] = await ejecutarSP(nombre, parametros);
  return (primero?.[0] as T | undefined) ?? null;
}

/** Todas las filas del primer resultado. */
export async function consultarLista<T>(nombre: NombreSP, parametros: ParametroSP[] = []): Promise<T[]> {
  const [primero] = await ejecutarSP(nombre, parametros);
  return (primero ?? []) as T[];
}

/** Para los SPs paginados, que devuelven TotalRegistros en cada fila. */
export async function consultarPaginado<T>(
  nombre: NombreSP,
  parametros: ParametroSP[],
  pagina: number,
  tamanoPagina: number,
): Promise<ResultadoPaginado<T>> {
  const filas = await consultarLista<Fila>(nombre, parametros);
  const totalRegistros = Number(filas[0]?.totalRegistros ?? 0);
  const items = filas.map(({ totalRegistros: _total, ...resto }) => resto as T);
  return {
    items,
    paginacion: {
      pagina,
      tamanoPagina,
      totalRegistros,
      totalPaginas: Math.ceil(totalRegistros / tamanoPagina),
    },
  };
}

/** Convierte en arreglo una columna que el SP devuelve como JSON (FOR JSON PATH). */
export function parsearJson<T>(valor: unknown): T[] {
  if (typeof valor !== 'string' || valor.length === 0) return [];
  return JSON.parse(valor) as T[];
}
