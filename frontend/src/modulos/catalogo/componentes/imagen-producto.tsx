import { useState } from 'react';
import { cn } from '@/lib/utils';
import { IconoCategoria } from './icono-categoria';

interface ImagenProductoProps {
  url: string | null | undefined;
  alt: string;
  categoria?: string;
  className?: string;
  /** La imagen principal de la página se carga de inmediato; las del listado, al acercarse. */
  prioridad?: boolean;
}

/**
 * Imagen cuadrada del producto. Se muestra completa sobre fondo blanco (object-contain): los empaques
 * altos, como una botella de aceite, no se recortan. Si no hay URL o no carga, muestra el ícono de su categoría.
 */
export function ImagenProducto({
  url,
  alt,
  categoria = '',
  className,
  prioridad = false,
}: ImagenProductoProps) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <div
        className={cn(
          'flex aspect-square items-center justify-center bg-linear-to-br from-secondary to-muted text-primary/40',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <IconoCategoria nombre={categoria} className="size-1/3" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading={prioridad ? 'eager' : 'lazy'}
      decoding="async"
      width={800}
      height={800}
      onError={() => setFallo(true)}
      className={cn('aspect-square w-full bg-white object-contain', className)}
    />
  );
}
