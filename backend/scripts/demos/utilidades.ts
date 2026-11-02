/**
 * Utilidades compartidas por los scripts de demostración. Se usan contra la API
 * levantada (npm run dev) para mostrar en vivo las reglas de negocio en la defensa.
 */
import { randomUUID } from 'node:crypto';

try {
  process.loadEnvFile();
} catch {
  // sin .env
}

export const BASE = process.env['DEMO_URL'] ?? `http://localhost:${process.env['PORT'] ?? 3000}`;

export const color = {
  verde: (t: string) => `\x1b[32m${t}\x1b[0m`,
  rojo: (t: string) => `\x1b[31m${t}\x1b[0m`,
  amarillo: (t: string) => `\x1b[33m${t}\x1b[0m`,
  gris: (t: string) => `\x1b[90m${t}\x1b[0m`,
  negrita: (t: string) => `\x1b[1m${t}\x1b[0m`,
};

export interface Respuesta {
  estado: number;
  cuerpo: { datos?: any; error?: { codigo: string; mensaje: string } } | null;
}

export async function api(
  metodo: string,
  ruta: string,
  opciones: { token?: string; body?: unknown; encabezados?: Record<string, string> } = {},
): Promise<Respuesta> {
  const respuesta = await fetch(`${BASE}/api${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      ...opciones.encabezados,
    },
    body: opciones.body === undefined ? null : JSON.stringify(opciones.body),
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null };
}

export async function login(correo: string, contrasena: string): Promise<string> {
  const r = await api('POST', '/auth/login', { body: { correo, contrasena } });
  if (r.estado !== 200) throw new Error(`No pude iniciar sesión con ${correo}: ${r.cuerpo?.error?.mensaje}`);
  return r.cuerpo!.datos.accessToken as string;
}

export const loginAdmin = () => login('admin@shopcart.test', 'Admin123!');

export interface ClienteDemo {
  nombre: string;
  token: string;
  idDireccion: number;
}

/**
 * Crea N clientes nuevos (con el endpoint de administración, que no tiene rate limit
 * de registro), inicia su sesión y les registra una dirección lista para comprar.
 */
export async function crearClientes(admin: string, cantidad: number, prefijo: string): Promise<ClienteDemo[]> {
  const nombres = ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fer', 'Gaby', 'Hugo', 'Isa', 'Jorge', 'Karla', 'Luis',
    'Majo', 'Nico', 'Olga', 'Pablo', 'Quique', 'Rosa', 'Sofi', 'Tito'];
  return Promise.all(
    Array.from({ length: cantidad }, async (_, i) => {
      const nombre = nombres[i % nombres.length]!;
      const correo = `${prefijo}.${nombre.toLowerCase()}.${randomUUID().slice(0, 6)}@demo.test`;
      const alta = await api('POST', '/usuarios', {
        token: admin,
        body: { correo, contrasena: 'Demo1234!', nombres: nombre, apellidos: 'Demo', rol: 'CLIENTE' },
      });
      if (alta.estado !== 201) throw new Error(`Alta de cliente: ${alta.cuerpo?.error?.mensaje}`);
      const token = await login(correo, 'Demo1234!');
      const direccion = await api('POST', '/direcciones', {
        token,
        body: {
          alias: 'Casa',
          nombreDestinatario: `${nombre} Demo`,
          telefono: '5555-0000',
          linea1: '6a. avenida 1-23',
          zona: 1,
          municipio: 'Guatemala',
          idDepartamento: 7,
        },
      });
      return { nombre, token, idDireccion: direccion.cuerpo!.datos.idDireccion as number };
    }),
  );
}

/** Crea un producto de demostración con la existencia indicada. */
export async function crearProducto(admin: string, nombre: string, existencia: number, precio = 150) {
  const sku = `DEMO-${randomUUID().slice(0, 6).toUpperCase()}`;
  const r = await api('POST', '/productos', {
    token: admin,
    body: { idCategoria: 1, nombre: `${nombre} (${sku})`, variantes: [{ sku, precio, existenciaInicial: existencia }] },
  });
  if (r.estado !== 201) throw new Error(`No pude crear el producto: ${r.cuerpo?.error?.mensaje}`);
  return { idProducto: r.cuerpo!.datos.idProducto as number, idVariante: r.cuerpo!.datos.variantes[0].idVariante as number, sku };
}

export const TARJETA = { numero: '4111111111111111', titular: 'Cliente Demo', expiracion: '12/30', cvv: '123' };

export function titulo(texto: string): void {
  console.log(`\n${color.negrita('━'.repeat(70))}\n${color.negrita(texto)}\n${color.negrita('━'.repeat(70))}`);
}

export async function verificarApi(): Promise<void> {
  try {
    const salud = await api('GET', '/salud');
    if (salud.estado !== 200) throw new Error();
  } catch {
    console.error(color.rojo(`No encuentro la API en ${BASE}. Levántala primero con "npm run dev".`));
    process.exit(1);
  }
}
