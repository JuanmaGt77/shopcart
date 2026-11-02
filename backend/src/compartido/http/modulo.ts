import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import { verificarAcceso } from '../middlewares/autenticacion.js';
import { ErrorNoAutenticado } from '../errores.js';
import type { Acceso, UsuarioAutenticado } from './tipos.js';

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Salida<E> = E extends z.ZodType ? z.output<E> : undefined;

export interface ContextoRuta<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  /** null solo en rutas públicas u opcionales cuando no se mandó token. */
  usuario: UsuarioAutenticado | null;
  req: Request;
  res: Response;
}

export interface EncabezadoDocumentado {
  descripcion: string;
  requerido: boolean;
}

export interface DefinicionRuta<
  B extends z.ZodType | undefined,
  Q extends z.ZodType | undefined,
  P extends z.ZodType | undefined,
> {
  metodo: Metodo;
  ruta: string;
  resumen: string;
  descripcion?: string;
  acceso: Acceso;
  body?: B;
  query?: Q;
  params?: P;
  encabezados?: Record<string, EncabezadoDocumentado>;
  /** Código HTTP de éxito (200 por defecto). */
  estado?: number;
  /** Middlewares que corren antes de la autenticación (por ejemplo, rate limiting). */
  antes?: RequestHandler[];
  manejador: (ctx: ContextoRuta<Salida<B>, Salida<Q>, Salida<P>>) => Promise<unknown>;
}

export interface RutaDocumentada {
  metodo: Metodo;
  ruta: string;
  etiqueta: string;
  resumen: string;
  descripcion?: string | undefined;
  acceso: Acceso;
  body?: z.ZodType | undefined;
  query?: z.ZodType | undefined;
  params?: z.ZodType | undefined;
  encabezados?: Record<string, EncabezadoDocumentado> | undefined;
  estado: number;
}

/**
 * Un módulo agrupa las rutas de un recurso. Cada ruta se declara una sola vez con
 * sus esquemas de Zod, y de esa declaración salen tres cosas:
 *   1. la validación de body, query y params (si no cumple, 400 con el detalle),
 *   2. el control de acceso por rol,
 *   3. su documentación en OpenAPI (Swagger).
 * El manejador solo recibe datos ya validados y tipados.
 */
export class Modulo {
  readonly router = Router();
  readonly rutas: RutaDocumentada[] = [];

  constructor(
    readonly base: string,
    readonly etiqueta: string,
  ) {}

  ruta<
    B extends z.ZodType | undefined = undefined,
    Q extends z.ZodType | undefined = undefined,
    P extends z.ZodType | undefined = undefined,
  >(definicion: DefinicionRuta<B, Q, P>): this {
    this.rutas.push({
      metodo: definicion.metodo,
      ruta: (this.base + definicion.ruta).replace(/\/$/, '') || '/',
      etiqueta: this.etiqueta,
      resumen: definicion.resumen,
      descripcion: definicion.descripcion,
      acceso: definicion.acceso,
      body: definicion.body,
      query: definicion.query,
      params: definicion.params,
      encabezados: definicion.encabezados,
      estado: definicion.estado ?? 200,
    });

    const manejador: RequestHandler = async (req, res) => {
      const contexto = {
        body: definicion.body ? definicion.body.parse(req.body ?? {}) : undefined,
        query: definicion.query ? definicion.query.parse(req.query) : undefined,
        params: definicion.params ? definicion.params.parse(req.params) : undefined,
        usuario: req.usuario ?? null,
        req,
        res,
      } as ContextoRuta<Salida<B>, Salida<Q>, Salida<P>>;

      const resultado = await definicion.manejador(contexto);
      if (res.headersSent) return;
      if (resultado === undefined) {
        res.status(204).end();
        return;
      }
      // Un controlador puede decidir el código (por ejemplo 200 en vez de 201 si fue un reintento)
      const estado = typeof res.locals['estado'] === 'number' ? res.locals['estado'] : (definicion.estado ?? 200);
      res.status(estado).json(resultado);
    };

    this.router[definicion.metodo](
      definicion.ruta,
      ...(definicion.antes ?? []),
      verificarAcceso(definicion.acceso),
      manejador,
    );
    return this;
  }
}

/** Para rutas protegidas: devuelve el usuario autenticado (el middleware ya lo garantizó). */
export function usuarioDe(contexto: { usuario: UsuarioAutenticado | null }): UsuarioAutenticado {
  if (!contexto.usuario) throw new ErrorNoAutenticado();
  return contexto.usuario;
}
