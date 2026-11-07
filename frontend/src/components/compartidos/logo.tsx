import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Muestra el subtítulo "Todo para tu ruta". */
  conLema?: boolean;
  destino?: string;
}

export function Logo({ className, conLema = true, destino = '/' }: LogoProps) {
  return (
    <Link
      to={destino}
      className={cn('flex items-center gap-2.5 rounded-md', className)}
      aria-label="ShopCart, ir al inicio"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShoppingCart className="size-5" aria-hidden />
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-promo ring-2 ring-background" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">ShopCart</span>
        {conLema && <span className="text-xs text-muted-foreground">Todo para tu ruta</span>}
      </span>
    </Link>
  );
}
