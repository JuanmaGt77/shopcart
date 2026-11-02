import { ErrorAplicacion } from '../compartido/errores.js';

/**
 * Los SPs lanzan errores de negocio con THROW y un número propio (50000+). Aquí se
 * traduce cada número a su código HTTP y a un código estable para el frontend.
 * El mensaje que ve el usuario es el que redactó el SP (en español y específico).
 */
const ERRORES_NEGOCIO: Record<number, { estado: number; codigo: string }> = {
  // Generales
  50001: { estado: 400, codigo: 'SOLICITUD_INVALIDA' },
  50003: { estado: 403, codigo: 'ACCESO_DENEGADO' },
  // Seguridad y usuarios
  51001: { estado: 409, codigo: 'CORREO_YA_REGISTRADO' },
  51002: { estado: 403, codigo: 'CUENTA_DESACTIVADA' },
  51003: { estado: 400, codigo: 'ROL_INVALIDO' },
  51004: { estado: 409, codigo: 'OPERACION_SOBRE_SI_MISMO' },
  51005: { estado: 404, codigo: 'USUARIO_NO_ENCONTRADO' },
  // Catálogo
  52001: { estado: 404, codigo: 'CATEGORIA_NO_ENCONTRADA' },
  52002: { estado: 409, codigo: 'CATEGORIA_DUPLICADA' },
  52003: { estado: 409, codigo: 'CATEGORIA_EN_USO' },
  52004: { estado: 422, codigo: 'CATEGORIA_INACTIVA' },
  52011: { estado: 404, codigo: 'PRODUCTO_NO_ENCONTRADO' },
  52012: { estado: 400, codigo: 'PRODUCTO_SIN_VARIANTES' },
  52021: { estado: 404, codigo: 'VARIANTE_NO_ENCONTRADA' },
  52022: { estado: 409, codigo: 'SKU_DUPLICADO' },
  52023: { estado: 409, codigo: 'VARIANTE_DUPLICADA' },
  52024: { estado: 400, codigo: 'PRECIO_INVALIDO' },
  52025: { estado: 422, codigo: 'PRODUCTO_NO_DISPONIBLE' },
  // Inventario
  53001: { estado: 400, codigo: 'TIPO_MOVIMIENTO_INVALIDO' },
  53002: { estado: 400, codigo: 'MOTIVO_REQUERIDO' },
  53003: { estado: 409, codigo: 'EXISTENCIA_NEGATIVA' },
  53004: { estado: 409, codigo: 'EXISTENCIA_RESERVADA' },
  53005: { estado: 409, codigo: 'STOCK_INSUFICIENTE' },
  // Carrito
  54001: { estado: 422, codigo: 'CARRITO_VACIO' },
  54002: { estado: 409, codigo: 'CANTIDAD_EXCEDE_DISPONIBLE' },
  54003: { estado: 404, codigo: 'PRODUCTO_NO_EN_CARRITO' },
  54005: { estado: 401, codigo: 'SESION_REQUERIDA' },
  // Cupones
  55001: { estado: 404, codigo: 'CUPON_NO_EXISTE' },
  55002: { estado: 422, codigo: 'CUPON_INACTIVO' },
  55003: { estado: 422, codigo: 'CUPON_NO_VIGENTE' },
  55004: { estado: 422, codigo: 'CUPON_VENCIDO' },
  55005: { estado: 422, codigo: 'CUPON_AGOTADO' },
  55006: { estado: 422, codigo: 'CUPON_LIMITE_CLIENTE' },
  55007: { estado: 422, codigo: 'CUPON_MONTO_MINIMO' },
  55008: { estado: 422, codigo: 'CUPON_SIN_PRODUCTOS_ELEGIBLES' },
  55009: { estado: 409, codigo: 'CUPON_DUPLICADO' },
  55010: { estado: 409, codigo: 'CUPON_LIMITE_INVALIDO' },
  // Direcciones
  56001: { estado: 404, codigo: 'DIRECCION_NO_ENCONTRADA' },
  56002: { estado: 422, codigo: 'DIRECCION_INACTIVA' },
  56003: { estado: 400, codigo: 'DEPARTAMENTO_INVALIDO' },
  // Checkout
  57001: { estado: 404, codigo: 'CHECKOUT_NO_ENCONTRADO' },
  57002: { estado: 409, codigo: 'RESERVA_EXPIRADA' },
  57003: { estado: 409, codigo: 'CHECKOUT_NO_ACTIVO' },
  57004: { estado: 400, codigo: 'METODO_ENVIO_INVALIDO' },
  57005: { estado: 409, codigo: 'IDEMPOTENCIA_CONFLICTO' },
  // Pedidos y devoluciones
  58001: { estado: 404, codigo: 'PEDIDO_NO_ENCONTRADO' },
  58002: { estado: 409, codigo: 'TRANSICION_NO_PERMITIDA' },
  58003: { estado: 409, codigo: 'PEDIDO_NO_CANCELABLE' },
  58004: { estado: 400, codigo: 'ESTADO_INVALIDO' },
  59001: { estado: 409, codigo: 'PEDIDO_NO_DEVOLVIBLE' },
  59002: { estado: 409, codigo: 'DEVOLUCION_EXCEDE_VENDIDO' },
  59003: { estado: 400, codigo: 'LINEA_NO_PERTENECE_AL_PEDIDO' },
  59004: { estado: 400, codigo: 'DEVOLUCION_SIN_LINEAS' },
  // Sistema
  60001: { estado: 403, codigo: 'BITACORA_INMUTABLE' },
  60002: { estado: 403, codigo: 'KARDEX_INMUTABLE' },
  60003: { estado: 403, codigo: 'HISTORIAL_INMUTABLE' },
  60004: { estado: 404, codigo: 'PARAMETRO_NO_ENCONTRADO' },
  60005: { estado: 400, codigo: 'PARAMETRO_FUERA_DE_RANGO' },
};

interface ErrorSqlServer {
  number?: number;
  message?: string;
  originalError?: { info?: { number?: number; message?: string } };
}

export function numeroErrorSql(error: unknown): number | undefined {
  const e = error as ErrorSqlServer;
  return e?.number ?? e?.originalError?.info?.number;
}

export function esDeadlock(error: unknown): boolean {
  return numeroErrorSql(error) === 1205;
}

/** Convierte un error de SQL Server en un ErrorAplicacion. Devuelve null si no es de SQL Server. */
export function traducirErrorBD(error: unknown): ErrorAplicacion | null {
  const numero = numeroErrorSql(error);
  if (numero === undefined) return null;

  const mensaje = (error as ErrorSqlServer).message ?? 'Error en la base de datos';
  const negocio = ERRORES_NEGOCIO[numero];
  if (negocio) return new ErrorAplicacion(negocio.estado, negocio.codigo, mensaje);
  if (numero >= 50000) return new ErrorAplicacion(422, 'REGLA_DE_NEGOCIO', mensaje);

  switch (numero) {
    case 2601:
    case 2627:
      return new ErrorAplicacion(409, 'REGISTRO_DUPLICADO', 'Ya existe un registro con esos datos.');
    case 547:
      return new ErrorAplicacion(409, 'RESTRICCION_DE_INTEGRIDAD', 'La operación no cumple una regla de integridad de los datos.');
    case 1205:
      return new ErrorAplicacion(503, 'CONFLICTO_DE_CONCURRENCIA', 'Hubo mucha concurrencia en este momento. Intenta de nuevo.');
    case 8114:
    case 8115:
    case 245:
      return new ErrorAplicacion(400, 'DATO_INVALIDO', 'Alguno de los datos enviados no tiene el formato correcto.');
    default:
      return null;
  }
}
