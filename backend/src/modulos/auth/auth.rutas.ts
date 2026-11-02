import { Modulo, usuarioDe } from '../../compartido/http/modulo.js';
import { CUALQUIER_ROL } from '../../compartido/http/tipos.js';
import { crearLimitador } from '../../compartido/middlewares/limitadores.js';
import { authControlador } from './auth.controlador.js';
import { loginEsquema, registroEsquema } from './auth.esquemas.js';

export interface OpcionesAuth {
  limiteLogin: number;
  limiteRegistro: number;
}

export function rutasAuth(opciones: OpcionesAuth): Modulo {
  // Solo cuentan los intentos fallidos: quien escribe bien su contraseña nunca se bloquea
  const limiteLogin = crearLimitador({
    maximo: opciones.limiteLogin,
    ventanaMinutos: 15,
    mensaje: 'Demasiados intentos fallidos de inicio de sesión. Espera unos minutos e intenta de nuevo.',
    soloFallidos: true,
  });
  const limiteRegistro = crearLimitador({
    maximo: opciones.limiteRegistro,
    ventanaMinutos: 15,
    mensaje: 'Demasiados registros desde esta conexión. Intenta más tarde.',
  });
  const limiteRefresh = crearLimitador({
    maximo: 60,
    ventanaMinutos: 15,
    mensaje: 'Demasiadas renovaciones de sesión. Intenta más tarde.',
  });

  return new Modulo('/api/auth', 'Autenticación')
    .ruta({
      metodo: 'post',
      ruta: '/registro',
      resumen: 'Registrar una cuenta de cliente',
      descripcion: 'Crea un usuario con rol Cliente, inicia su sesión y deja el refresh token en una cookie httpOnly.',
      acceso: 'publico',
      body: registroEsquema,
      estado: 201,
      antes: [limiteRegistro],
      manejador: ({ body, req, res }) => authControlador.registrar(body, req, res),
    })
    .ruta({
      metodo: 'post',
      ruta: '/login',
      resumen: 'Iniciar sesión',
      descripcion:
        'Devuelve un access token JWT (15 minutos) y deja el refresh token en la cookie shopcart_rt. Se bloquea por 15 minutos la IP que acumule 10 intentos fallidos.',
      acceso: 'publico',
      body: loginEsquema,
      antes: [limiteLogin],
      manejador: ({ body, req, res }) => authControlador.iniciarSesion(body, req, res),
    })
    .ruta({
      metodo: 'post',
      ruta: '/refresh',
      resumen: 'Renovar el access token',
      descripcion:
        'Usa la cookie shopcart_rt. Rota el refresh token: el anterior queda revocado. Si alguien presenta un token ya rotado, se cierra toda la sesión.',
      acceso: 'publico',
      antes: [limiteRefresh],
      manejador: ({ req, res }) => authControlador.renovar(req, res),
    })
    .ruta({
      metodo: 'post',
      ruta: '/logout',
      resumen: 'Cerrar sesión',
      descripcion: 'Revoca la familia completa del refresh token y borra la cookie.',
      acceso: 'publico',
      manejador: ({ req, res }) => authControlador.cerrarSesion(req, res),
    })
    .ruta({
      metodo: 'get',
      ruta: '/perfil',
      resumen: 'Perfil del usuario autenticado',
      acceso: CUALQUIER_ROL,
      manejador: (ctx) => authControlador.perfil(usuarioDe(ctx)),
    });
}
