import sql from 'mssql';

/**
 * Constructores de los parámetros tabla (TVP). Las columnas van en el mismo orden
 * que el tipo definido en database/scripts/010_Tipos.sql.
 */

export interface VarianteNueva {
  clave: number;
  sku: string;
  precio: number;
  existenciaInicial: number;
}

export interface AtributoDeVariante {
  claveVariante: number;
  atributo: string;
  valor: string;
}

export interface ImagenProducto {
  orden: number;
  url: string;
  textoAlternativo?: string | null | undefined;
}

export interface LineaDevolucion {
  idPedidoDetalle: number;
  cantidad: number;
}

export function tablaVariantes(variantes: VarianteNueva[]): sql.Table {
  const tabla = new sql.Table('dbo.TT_Catalogo_Variante');
  tabla.columns.add('Clave', sql.Int, { nullable: false });
  tabla.columns.add('SKU', sql.VarChar(40), { nullable: false });
  tabla.columns.add('Precio', sql.Decimal(12, 2), { nullable: false });
  tabla.columns.add('ExistenciaInicial', sql.Int, { nullable: false });
  for (const v of variantes) tabla.rows.add(v.clave, v.sku, v.precio, v.existenciaInicial);
  return tabla;
}

export function tablaAtributos(atributos: AtributoDeVariante[]): sql.Table {
  const tabla = new sql.Table('dbo.TT_Catalogo_AtributoVariante');
  tabla.columns.add('ClaveVariante', sql.Int, { nullable: false });
  tabla.columns.add('Atributo', sql.NVarChar(50), { nullable: false });
  tabla.columns.add('Valor', sql.NVarChar(50), { nullable: false });
  for (const a of atributos) tabla.rows.add(a.claveVariante, a.atributo, a.valor);
  return tabla;
}

export function tablaImagenes(imagenes: ImagenProducto[]): sql.Table {
  const tabla = new sql.Table('dbo.TT_Catalogo_Imagen');
  tabla.columns.add('Orden', sql.SmallInt, { nullable: false });
  tabla.columns.add('Url', sql.NVarChar(500), { nullable: false });
  tabla.columns.add('TextoAlternativo', sql.NVarChar(150), { nullable: true });
  for (const i of imagenes) tabla.rows.add(i.orden, i.url, i.textoAlternativo ?? null);
  return tabla;
}

export function tablaLineasDevolucion(lineas: LineaDevolucion[]): sql.Table {
  const tabla = new sql.Table('dbo.TT_Devoluciones_Linea');
  tabla.columns.add('IDPedidoDetalle', sql.Int, { nullable: false });
  tabla.columns.add('Cantidad', sql.Int, { nullable: false });
  for (const l of lineas) tabla.rows.add(l.idPedidoDetalle, l.cantidad);
  return tabla;
}
