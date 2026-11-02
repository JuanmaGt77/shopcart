export const ROLES = ['CLIENTE', 'OPERADOR', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];

export interface UsuarioAutenticado {
  id: number;
  rol: Rol;
  correo: string;
}

/** Quién puede llamar una ruta: cualquiera, cualquiera (pero si manda token se valida) o ciertos roles. */
export type Acceso = 'publico' | 'opcional' | readonly Rol[];

export const SOLO_CLIENTE = ['CLIENTE'] as const satisfies readonly Rol[];
export const PERSONAL = ['OPERADOR', 'ADMIN'] as const satisfies readonly Rol[];
export const SOLO_ADMIN = ['ADMIN'] as const satisfies readonly Rol[];
export const CUALQUIER_ROL = ['CLIENTE', 'OPERADOR', 'ADMIN'] as const satisfies readonly Rol[];
