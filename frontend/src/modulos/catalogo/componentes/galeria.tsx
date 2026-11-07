import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ImagenProducto as Imagen } from '../tipos';
import { ImagenProducto } from './imagen-producto';

export function Galeria({
  imagenes,
  nombre,
  categoria,
}: {
  imagenes: Imagen[];
  nombre: string;
  categoria: string;
}) {
  const ordenadas = [...imagenes].sort((a, b) => a.orden - b.orden);
  const [indice, setIndice] = useState(0);
  const actual = ordenadas[indice] ?? ordenadas[0];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border">
        <ImagenProducto
          url={actual?.url}
          alt={actual?.textoAlternativo ?? nombre}
          categoria={categoria}
          prioridad
        />
      </div>
      {ordenadas.length > 1 && (
        <div className="flex gap-2" role="group" aria-label="Imágenes del producto">
          {ordenadas.map((imagen, i) => (
            <button
              key={imagen.url}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-pressed={i === indice}
              className={cn(
                'size-16 overflow-hidden rounded-lg border-2 sm:size-20',
                i === indice ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <ImagenProducto url={imagen.url} alt="" categoria={categoria} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
