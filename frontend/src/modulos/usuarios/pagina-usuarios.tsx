import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { pedir, pedirPaginado } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
import { BarraFiltros, EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { Paginador } from '@/components/compartidos/paginador';
import { TablaResponsiva, type Columna } from '@/components/compartidos/tabla-responsiva';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enUrl, useFiltrosUrl } from '@/hooks/use-filtros-url';
import { mensajeDeError } from '@/lib/errores';
import { formatearFechaHora } from '@/lib/formato';
import { NOMBRE_ROL, ROLES, type Usuario } from '@/modulos/auth/tipos';
import { useSesion } from '@/modulos/auth/use-sesion';
import { DialogoUsuario } from './dialogo-usuario';

const esquemaUrl = z.object({
  texto: enUrl.texto(),
  rol: enUrl.opcion(ROLES),
  activo: enUrl.opcion(['true', 'false']),
  pagina: enUrl.pagina(),
});

export function PaginaUsuarios() {
  const { usuario: yo } = useSesion();
  const cliente = useQueryClient();
  const { filtros, cambiar, limpiar } = useFiltrosUrl(esquemaUrl);
  const [dialogo, setDialogo] = useState<{ abierto: boolean; usuario?: Usuario }>({ abierto: false });
  const [porDesactivar, setPorDesactivar] = useState<Usuario | null>(null);

  const usuarios = useQuery({
    queryKey: [PREFIJO.usuarios, filtros],
    queryFn: ({ signal }) =>
      pedirPaginado<Usuario>('/usuarios', { consulta: { ...filtros, tamanoPagina: 20 }, senal: signal }),
    placeholderData: keepPreviousData,
  });

  const estado = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      pedir<Usuario>(`/usuarios/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } }),
    onSuccess: (u) => {
      toast.success(
        u.activo ? `${u.nombres} puede volver a entrar` : `${u.nombres} fue desactivado y su sesión se cerró`,
      );
      void cliente.invalidateQueries({ queryKey: [PREFIJO.usuarios] });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const columnas: Columna<Usuario>[] = [
    {
      clave: 'usuario',
      titulo: 'Usuario',
      celda: (u) => (
        <span className="block max-w-64">
          <span className="block truncate font-medium">
            {u.nombres} {u.apellidos}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{u.correo}</span>
        </span>
      ),
    },
    {
      clave: 'rol',
      titulo: 'Rol',
      celda: (u) => (
        <Badge variant={u.rol === 'CLIENTE' ? 'outline' : 'secondary'}>{NOMBRE_ROL[u.rol]}</Badge>
      ),
    },
    { clave: 'telefono', titulo: 'Teléfono', celda: (u) => u.telefono ?? '—', soloEscritorio: true },
    {
      clave: 'acceso',
      titulo: 'Último acceso',
      celda: (u) => (u.fechaUltimoAcceso ? formatearFechaHora(u.fechaUltimoAcceso) : 'Nunca'),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (u) =>
        u.activo ? (
          <Badge variant="secondary">Activo</Badge>
        ) : (
          <Badge variant="destructive">Desactivado</Badge>
        ),
    },
  ];

  return (
    <>
      <EncabezadoPanel descripcion="Al desactivar a alguien pierde el acceso al instante: su sesión y su conexión en vivo se cierran, y no puede volver a entrar.">
        <Button onClick={() => setDialogo({ abierto: true })}>
          <UserPlus /> Nuevo usuario
        </Button>
      </EncabezadoPanel>

      <BarraFiltros>
        <div className="grid gap-1.5">
          <Label htmlFor="usuarios-texto" className="text-xs">
            Nombre o correo
          </Label>
          <Input
            id="usuarios-texto"
            type="search"
            className="w-60 bg-background"
            defaultValue={filtros.texto ?? ''}
            key={filtros.texto ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && cambiar({ texto: e.currentTarget.value.trim() })}
            onBlur={(e) =>
              e.currentTarget.value.trim() !== (filtros.texto ?? '') &&
              cambiar({ texto: e.currentTarget.value.trim() })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="usuarios-rol" className="text-xs">
            Rol
          </Label>
          <Select
            value={filtros.rol ?? 'todos'}
            onValueChange={(v) => cambiar({ rol: v === 'todos' ? undefined : v })}
          >
            <SelectTrigger id="usuarios-rol" className="w-40 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="usuarios-activo" className="text-xs">
            Estado
          </Label>
          <Select
            value={filtros.activo ?? 'todos'}
            onValueChange={(v) => cambiar({ activo: v === 'todos' ? undefined : v })}
          >
            <SelectTrigger id="usuarios-activo" className="w-40 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="true">Activos</SelectItem>
              <SelectItem value="false">Desactivados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(filtros.texto || filtros.rol || filtros.activo) && (
          <Button variant="ghost" onClick={() => limpiar()}>
            <X /> Limpiar
          </Button>
        )}
      </BarraFiltros>

      {usuarios.isError ? (
        <EstadoError error={usuarios.error} alReintentar={() => void usuarios.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Usuarios"
          columnas={columnas}
          filas={usuarios.data?.datos}
          claveFila={(u) => u.idUsuario}
          cargando={usuarios.isFetching}
          acciones={(u) => (
            <>
              <Button variant="outline" size="sm" onClick={() => setDialogo({ abierto: true, usuario: u })}>
                <Pencil /> Editar
              </Button>
              {u.idUsuario !== yo?.idUsuario &&
                (u.activo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setPorDesactivar(u)}
                  >
                    Desactivar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={estado.isPending}
                    onClick={() => estado.mutate({ id: u.idUsuario, activo: true })}
                  >
                    Activar
                  </Button>
                ))}
            </>
          )}
          vacio={<EstadoVacio icono={Users} titulo="No hay usuarios con estos filtros" />}
        />
      )}

      {usuarios.data && (
        <Paginador
          className="mt-4"
          pagina={usuarios.data.paginacion.pagina}
          totalPaginas={usuarios.data.paginacion.totalPaginas}
          totalRegistros={usuarios.data.paginacion.totalRegistros}
          alCambiar={(pagina) => cambiar({ pagina })}
        />
      )}

      <DialogoUsuario
        key={dialogo.usuario?.idUsuario ?? `nuevo-${dialogo.abierto}`}
        abierto={dialogo.abierto}
        usuario={dialogo.usuario}
        alCambiarAbierto={(abierto) => setDialogo((d) => ({ ...d, abierto }))}
      />

      <AlertDialog open={porDesactivar !== null} onOpenChange={(a) => !a && setPorDesactivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar a {porDesactivar?.nombres} {porDesactivar?.apellidos}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Su sesión se cerrará en todos sus dispositivos en este momento y no podrá volver a entrar hasta
              que lo actives. Su historial de pedidos se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => porDesactivar && estado.mutate({ id: porDesactivar.idUsuario, activo: false })}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
