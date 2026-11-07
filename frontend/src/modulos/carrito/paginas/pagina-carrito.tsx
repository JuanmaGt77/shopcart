import { Store } from 'lucide-react';
import { Link } from 'react-router';
import { EstadoVacio } from '@/components/compartidos/estados';
import { Button } from '@/components/ui/button';
import { ContenidoCarrito } from '../componentes/contenido-carrito';
import { usePuedeComprar } from '../consultas';

export function PaginaCarrito() {
  const puedeComprar = usePuedeComprar();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Tu carrito</h1>
      {puedeComprar ? (
        <ContenidoCarrito modo="pagina" />
      ) : (
        <EstadoVacio
          icono={Store}
          titulo="El carrito es solo para clientes"
          descripcion="El personal no compra con su cuenta de trabajo. Usa una cuenta de cliente para comprar."
        >
          <Button asChild variant="outline">
            <Link to="/panel">Ir al panel</Link>
          </Button>
        </EstadoVacio>
      )}
    </div>
  );
}
