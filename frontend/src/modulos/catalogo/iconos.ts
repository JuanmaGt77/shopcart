import {
  Car,
  Coffee,
  Cookie,
  Droplet,
  FlaskConical,
  Motorbike,
  Shirt,
  SprayCan,
  Tag,
  type LucideIcon,
} from 'lucide-react';

/** Ícono genérico por categoría (se busca por nombre; las categorías nuevas usan una etiqueta). */
const ICONOS: Record<string, LucideIcon> = {
  'ropa y mercancía': Shirt,
  'aditivos y fluidos': FlaskConical,
  'cuidado del vehículo': SprayCan,
  lubricantes: Droplet,
  motos: Motorbike,
  'accesorios para auto': Car,
  'snacks y dulces': Cookie,
  'bebidas y café': Coffee,
};

export function iconoCategoria(nombre: string): LucideIcon {
  return ICONOS[nombre.toLocaleLowerCase('es')] ?? Tag;
}
