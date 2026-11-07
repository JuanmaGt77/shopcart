import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Búsqueda de la tienda: lleva al catálogo con ?q= (y conserva la categoría si ya está filtrando). */
export function Buscador({ className }: { className?: string }) {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [parametros] = useSearchParams();
  const enCatalogo = ubicacion.pathname === '/productos';
  const qActual = enCatalogo ? (parametros.get('q') ?? '') : '';
  const [texto, setTexto] = useState(qActual);
  const [qAnterior, setQAnterior] = useState(qActual);

  // Si la URL cambia (Atrás, quitar filtro), el campo muestra lo que dice la URL
  if (qActual !== qAnterior) {
    setQAnterior(qActual);
    setTexto(qActual);
  }

  const buscar = (evento: FormEvent) => {
    evento.preventDefault();
    const siguientes = new URLSearchParams(enCatalogo ? parametros : undefined);
    const limpio = texto.trim();
    if (limpio) siguientes.set('q', limpio);
    else siguientes.delete('q');
    siguientes.delete('pagina');
    navegar(`/productos${siguientes.size ? `?${siguientes.toString()}` : ''}`);
  };

  return (
    <form role="search" onSubmit={buscar} className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Busca aceite, casco, café…"
        aria-label="Buscar productos"
        className="h-10 rounded-full bg-muted/60 pl-9"
        maxLength={100}
      />
    </form>
  );
}
