/**
 * Errores de la aplicación. Cualquier capa puede lanzarlos; el manejador central
 * los convierte en la respuesta JSON con su código HTTP.
 */
export class ErrorAplicacion extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
  }
}

export class ErrorValidacion extends ErrorAplicacion {
  constructor(mensaje: string, detalles?: unknown) {
    super(400, 'VALIDACION', mensaje, detalles);
  }
}

export class ErrorNoAutenticado extends ErrorAplicacion {
  constructor(codigo = 'NO_AUTENTICADO', mensaje = 'Necesitas iniciar sesión para continuar.') {
    super(401, codigo, mensaje);
  }
}

export class ErrorProhibido extends ErrorAplicacion {
  constructor(mensaje = 'No tienes permiso para realizar esta acción.', codigo = 'ACCESO_DENEGADO') {
    super(403, codigo, mensaje);
  }
}

export class ErrorNoEncontrado extends ErrorAplicacion {
  constructor(mensaje = 'El recurso no existe.', codigo = 'NO_ENCONTRADO') {
    super(404, codigo, mensaje);
  }
}

export class ErrorConflicto extends ErrorAplicacion {
  constructor(mensaje: string, codigo = 'CONFLICTO') {
    super(409, codigo, mensaje);
  }
}
