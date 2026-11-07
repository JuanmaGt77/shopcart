import { useMutation } from '@tanstack/react-query';
import { LayoutDashboard, LogIn, LogOut, MapPin, Package, Store, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { iniciales } from '@/lib/texto';
import { cerrarSesion } from '../api';
import { esPersonal, NOMBRE_ROL } from '../tipos';
import { useSesion } from '../use-sesion';

/** Menú de la cuenta en el encabezado: accesos según el rol y cerrar sesión. */
export function MenuUsuario({ enPanel = false }: { enPanel?: boolean }) {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const salir = useMutation({
    mutationFn: cerrarSesion,
    onSettled: () => {
      toast.success('Cerraste sesión');
      navegar('/');
    },
  });

  if (!usuario) {
    return (
      <Button asChild variant="ghost" size="lg">
        <Link to="/login">
          <LogIn /> <span className="hidden sm:inline">Iniciar sesión</span>
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Menú de tu cuenta">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {iniciales(usuario.nombres, usuario.apellidos)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">
            {usuario.nombres} {usuario.apellidos}
          </p>
          <p className="truncate text-xs text-muted-foreground">{usuario.correo}</p>
          <p className="mt-1 text-xs font-medium text-primary">{NOMBRE_ROL[usuario.rol]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {usuario.rol === 'CLIENTE' && (
            <>
              <DropdownMenuItem asChild>
                <Link to="/cuenta/pedidos">
                  <Package /> Mis pedidos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/cuenta/direcciones">
                  <MapPin /> Mis direcciones
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/cuenta/perfil">
                  <UserRound /> Mi perfil
                </Link>
              </DropdownMenuItem>
            </>
          )}
          {esPersonal(usuario.rol) &&
            (enPanel ? (
              <DropdownMenuItem asChild>
                <Link to="/">
                  <Store /> Ver la tienda
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/panel">
                  <LayoutDashboard /> Ir al panel
                </Link>
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => salir.mutate()} disabled={salir.isPending}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
