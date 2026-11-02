import { z } from 'zod';
import type { Modulo, RutaDocumentada } from '../compartido/http/modulo.js';
import type { Acceso } from '../compartido/http/tipos.js';

type Esquema = Record<string, unknown>;

function aJsonSchema(esquema: z.ZodType): Esquema {
  const { $schema: _version, ...resto } = z.toJSONSchema(esquema, {
    io: 'input',
    unrepresentable: 'any',
  }) as Esquema;
  return resto;
}

function parametros(esquema: z.ZodType | undefined, ubicacion: 'path' | 'query') {
  if (!esquema) return [];
  const json = aJsonSchema(esquema) as { properties?: Record<string, Esquema>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([nombre, schema]) => ({
    name: nombre,
    in: ubicacion,
    required: ubicacion === 'path' || (json.required ?? []).includes(nombre),
    schema,
  }));
}

function describirAcceso(acceso: Acceso): string {
  if (acceso === 'publico') return '**Acceso:** público.';
  if (acceso === 'opcional') return '**Acceso:** público; si se envía un token se usa el carrito del cliente.';
  return `**Acceso:** ${acceso.join(', ')}.`;
}

function respuestas(ruta: RutaDocumentada): Esquema {
  const error = (descripcion: string) => ({
    description: descripcion,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  });

  const resultado: Esquema = {
    [String(ruta.estado)]: {
      description: ruta.estado === 201 ? 'Creado' : ruta.estado === 204 ? 'Sin contenido' : 'Operación exitosa',
      ...(ruta.estado === 204 ? {} : { content: { 'application/json': { schema: { $ref: '#/components/schemas/Respuesta' } } } }),
    },
  };
  if (ruta.body || ruta.query || ruta.params) resultado['400'] = error('Datos inválidos (con el detalle de cada campo)');
  if (ruta.acceso !== 'publico') resultado['401'] = error('Sin token, token inválido o token expirado');
  if (Array.isArray(ruta.acceso)) resultado['403'] = error('El rol no tiene permiso o el recurso es de otro cliente');
  if (ruta.params) resultado['404'] = error('El recurso no existe');
  if (ruta.metodo !== 'get') {
    resultado['409'] = error('Conflicto con el estado actual (existencia, transición, duplicado...)');
    resultado['422'] = error('No se cumple una regla de negocio (cupón vencido, carrito vacío...)');
  }
  return resultado;
}

/** Genera el documento OpenAPI 3.1 a partir de las rutas declaradas en los módulos. */
export function generarOpenAPI(modulos: Modulo[]): Esquema {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const ruta of modulos.flatMap((m) => m.rutas)) {
    const path = ruta.ruta.replace(/:([A-Za-z]+)/g, '{$1}');
    const encabezados = Object.entries(ruta.encabezados ?? {}).map(([nombre, info]) => ({
      name: nombre,
      in: 'header',
      required: info.requerido,
      description: info.descripcion,
      schema: { type: 'string' },
    }));

    (paths[path] ??= {})[ruta.metodo] = {
      tags: [ruta.etiqueta],
      summary: ruta.resumen,
      description: [describirAcceso(ruta.acceso), ruta.descripcion].filter(Boolean).join('\n\n'),
      ...(ruta.acceso === 'publico' ? {} : { security: [{ bearerAuth: [] }] }),
      parameters: [...parametros(ruta.params, 'path'), ...parametros(ruta.query, 'query'), ...encabezados],
      ...(ruta.body
        ? { requestBody: { required: true, content: { 'application/json': { schema: aJsonSchema(ruta.body) } } } }
        : {}),
      responses: respuestas(ruta),
    };
  }

  const etiquetas = [...new Set(modulos.map((m) => m.etiqueta))].map((nombre) => ({ name: nombre }));

  return {
    openapi: '3.1.0',
    info: {
      title: 'ShopCart API',
      version: '1.0.0',
      description: [
        'API de la tienda en línea ShopCart (Tech Challenge 360).',
        'Todas las respuestas exitosas tienen la forma `{ datos }` (y `paginacion` en los listados).',
        'Los errores tienen la forma `{ error: { codigo, mensaje, detalles?, idSolicitud } }`.',
        'Para probar rutas protegidas: haz login, copia el `accessToken` y pégalo en **Authorize**.',
        'Credenciales de prueba: admin@shopcart.test / Admin123!, operador@shopcart.test / Operador123!, cliente@shopcart.test / Cliente123!',
      ].join('\n\n'),
    },
    servers: [{ url: '/' }],
    tags: etiquetas,
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Respuesta: {
          type: 'object',
          properties: {
            datos: {},
            paginacion: {
              type: 'object',
              properties: {
                pagina: { type: 'integer' },
                tamanoPagina: { type: 'integer' },
                totalRegistros: { type: 'integer' },
                totalPaginas: { type: 'integer' },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                codigo: { type: 'string', example: 'STOCK_INSUFICIENTE' },
                mensaje: { type: 'string', example: 'Ya no hay suficientes unidades disponibles: PLABAS-NEG-M (pediste 3, hay 1).' },
                detalles: { type: 'array', items: { type: 'object' } },
                idSolicitud: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}
