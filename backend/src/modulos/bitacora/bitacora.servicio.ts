import { bitacoraRepositorio } from './bitacora.repositorio.js';
import type { FiltroBitacora } from './bitacora.esquemas.js';

function json(valor: unknown): unknown {
  return typeof valor === 'string' ? JSON.parse(valor) : null;
}

export const bitacoraServicio = {
  async listar(filtro: FiltroBitacora) {
    const resultado = await bitacoraRepositorio.listar(filtro);
    // Valor anterior y nuevo se guardan como JSON; aquí se devuelven como objetos
    return {
      ...resultado,
      items: resultado.items.map((fila) => ({
        ...fila,
        valorAnterior: json(fila.valorAnterior),
        valorNuevo: json(fila.valorNuevo),
      })),
    };
  },

  resumenModulos: () => bitacoraRepositorio.resumenModulos(),
};
