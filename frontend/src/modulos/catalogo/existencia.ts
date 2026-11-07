/** Desde cuántas unidades se avisa "últimas unidades" (igual que el parámetro UMBRAL_STOCK_BAJO de las semillas). */
export const UMBRAL_POCAS_UNIDADES = 5;

export type NivelExistencia = 'agotado' | 'pocas' | 'disponible';

export function nivelExistencia(disponible: number): NivelExistencia {
  if (disponible <= 0) return 'agotado';
  if (disponible <= UMBRAL_POCAS_UNIDADES) return 'pocas';
  return 'disponible';
}
