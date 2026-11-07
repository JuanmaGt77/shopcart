import { Droplet, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/compartidos/logo';

const BENEFICIOS = [
  { icono: Droplet, texto: 'Lubricantes de las marcas que ya conoces' },
  { icono: Truck, texto: 'Envío a todo el país o recoge en la estación' },
  { icono: PackageCheck, texto: 'Sigue tu pedido en tiempo real' },
  { icono: ShieldCheck, texto: 'Pago seguro, sin cobros dobles' },
];

/** Marco de las pantallas de login y registro: formulario a la derecha y beneficios en escritorio. */
export function MarcoAcceso({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-marca p-10 text-marca-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-promo/30 blur-3xl"
          aria-hidden
        />
        <p className="relative text-sm font-medium tracking-wide text-marca-foreground/80 uppercase">
          La tienda en línea de tu estación
        </p>
        <div className="relative space-y-6">
          <h2 className="max-w-md text-4xl leading-tight font-bold text-balance">
            Lo que compras en la estación, ahora desde tu celular.
          </h2>
          <ul className="space-y-3">
            {BENEFICIOS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-marca-foreground/90">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                  <Icono className="size-4" aria-hidden />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-marca-foreground/70">
          Proyecto del Tech Challenge 360. Precios y productos de referencia.
        </p>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{subtitulo}</p>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
