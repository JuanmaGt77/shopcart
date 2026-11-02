import sql from 'mssql';

/**
 * Parámetros tipados para los SPs. Cada valor viaja por separado del nombre del
 * procedimiento en la llamada RPC (TDS), con su tipo de SQL Server. Nunca se arma
 * texto SQL, por eso no hay forma de inyectar código.
 */
export interface ParametroValor {
  nombre: string;
  tipo: sql.ISqlType | (() => sql.ISqlType);
  valor: unknown;
}

export interface ParametroTabla {
  nombre: string;
  tabla: sql.Table;
}

export type ParametroSP = ParametroValor | ParametroTabla;

/** 'AAAA-MM-DD' -> Date a medianoche UTC (el driver envía en UTC). */
function fechaSinHora(valor: string): Date {
  const [anio, mes, dia] = valor.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1));
}

export const p = {
  entero: (nombre: string, valor: number | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.Int,
    valor: valor ?? null,
  }),
  bit: (nombre: string, valor: boolean | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.Bit,
    valor: valor ?? null,
  }),
  texto: (nombre: string, longitud: number, valor: string | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.NVarChar(longitud),
    valor: valor ?? null,
  }),
  ascii: (nombre: string, longitud: number, valor: string | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.VarChar(longitud),
    valor: valor ?? null,
  }),
  caracteres: (nombre: string, longitud: number, valor: string | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.Char(longitud),
    valor: valor ?? null,
  }),
  dinero: (nombre: string, valor: number | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.Decimal(12, 2),
    valor: valor ?? null,
  }),
  fechaHora: (nombre: string, valor: Date | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.DateTime2(3),
    valor: valor ?? null,
  }),
  fecha: (nombre: string, valor: string | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.Date,
    valor: valor ? fechaSinHora(valor) : null,
  }),
  guid: (nombre: string, valor: string | null | undefined): ParametroValor => ({
    nombre,
    tipo: sql.UniqueIdentifier,
    valor: valor ?? null,
  }),
  tabla: (nombre: string, tabla: sql.Table): ParametroTabla => ({ nombre, tabla }),
};
