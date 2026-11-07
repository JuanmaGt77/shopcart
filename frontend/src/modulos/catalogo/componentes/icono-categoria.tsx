import type { LucideProps } from 'lucide-react';
import { createElement } from 'react';
import { iconoCategoria } from '../iconos';

/** Ícono de una categoría como componente (para usarlo directo en JSX). */
export function IconoCategoria({ nombre, ...props }: { nombre: string } & LucideProps) {
  return createElement(iconoCategoria(nombre), props);
}
