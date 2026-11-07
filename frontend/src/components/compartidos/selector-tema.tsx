import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cambiarTema, useTema } from '@/lib/tema';

const OPCIONES = [
  { valor: 'light', texto: 'Claro', icono: Sun },
  { valor: 'dark', texto: 'Oscuro', icono: Moon },
  { valor: 'system', texto: 'Como el sistema', icono: Monitor },
] as const;

/** Tema claro, oscuro o el del sistema operativo (se recuerda en este navegador). */
export function SelectorTema() {
  const { tema, resuelto } = useTema();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Cambiar el tema">
          {resuelto === 'dark' ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPCIONES.map(({ valor, texto, icono: Icono }) => (
          <DropdownMenuItem key={valor} onSelect={() => cambiarTema(valor)}>
            <Icono /> {texto}
            {tema === valor && <Check className="ml-auto" aria-label="seleccionado" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
