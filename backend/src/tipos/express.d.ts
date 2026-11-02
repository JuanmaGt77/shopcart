import type { UsuarioAutenticado } from '../compartido/http/tipos.js';

declare global {
  namespace Express {
    interface Request {
      /** Lo llena el middleware de autenticación a partir del access token. */
      usuario?: UsuarioAutenticado;
    }
  }
}

export {};
