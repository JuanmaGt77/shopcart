import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function PaginaNoEncontrada() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <p className="text-muted-foreground">Revisa la dirección o vuelve a la tienda.</p>
      <Button asChild>
        <Link to="/">Ir al inicio</Link>
      </Button>
    </main>
  );
}
