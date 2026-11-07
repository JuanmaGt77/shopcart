export const ROLES = ['CLIENTE', 'OPERADOR', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];

export const NOMBRE_ROL: Record<Rol, string> = {
  CLIENTE: 'Cliente',
  OPERADOR: 'Operador',
  ADMIN: 'Administrador',
};

/** Perfil que devuelve la API en el login, el registro, la renovación y GET /auth/perfil. */
export interface Usuario {
  idUsuario: number;
  correo: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  fechaCreacion: string;
  fechaUltimoAcceso: string | null;
}

export interface RespuestaSesion {
  usuario: Usuario;
  accessToken: string;
  /** Segundos de vida del access token. */
  expiraEn: number;
}

export const esPersonal = (rol: Rol | undefined): boolean => rol === 'OPERADOR' || rol === 'ADMIN';
