import { formatearQuetzales } from '@/lib/formato';
import { ImagenProducto } from '@/modulos/catalogo/componentes/imagen-producto';

interface LineaResumen {
  idVariante: number;
  nombreProducto: string;
  descripcionVariante: string | null;
  cantidad: number;
  subtotal: number;
  imagenUrl: string | null;
}

/** Lista compacta de productos con su cantidad y subtotal (los montos vienen de la API). */
export function ResumenLineas({ lineas }: { lineas: LineaResumen[] }) {
  return (
    <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {lineas.map((linea) => (
        <li key={linea.idVariante} className="flex items-center gap-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md border">
            <ImagenProducto url={linea.imagenUrl} alt={linea.nombreProducto} />
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
              {linea.cantidad}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{linea.nombreProducto}</p>
            {linea.descripcionVariante && (
              <p className="truncate text-xs text-muted-foreground">{linea.descripcionVariante}</p>
            )}
          </div>
          <p className="text-sm tabular-nums">{formatearQuetzales(linea.subtotal)}</p>
        </li>
      ))}
    </ul>
  );
}
