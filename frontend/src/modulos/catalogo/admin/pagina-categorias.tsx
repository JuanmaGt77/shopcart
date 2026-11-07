import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EncabezadoPanel } from '@/components/compartidos/encabezado-panel';
import { EstadoError, EstadoVacio } from '@/components/compartidos/estados';
import { TablaResponsiva } from '@/components/compartidos/tabla-responsiva';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { IconoCategoria } from '../componentes/icono-categoria';
import { useCategorias } from '../consultas';
import type { Categoria } from '../tipos';
import { apiCatalogoAdmin, useMutacionCatalogo } from './api';

export function PaginaCategorias() {
  const categorias = useCategorias(true);
  const [dialogo, setDialogo] = useState<{ abierto: boolean; categoria?: Categoria }>({ abierto: false });
  const estado = useMutacionCatalogo(
    ({ id, activo }: { id: number; activo: boolean }) => apiCatalogoAdmin.estadoCategoria(id, activo),
    (c) => `${c.nombre}: ${c.activo ? 'activa' : 'inactiva'}`,
  );
  const eliminar = useMutacionCatalogo(
    (id: number) => apiCatalogoAdmin.eliminarCategoria(id),
    'Categoría eliminada',
  );

  return (
    <>
      <EncabezadoPanel descripcion="Categorías de un solo nivel. Una categoría con productos no se puede eliminar; desactívala para ocultarla de la tienda.">
        <Button onClick={() => setDialogo({ abierto: true })}>
          <Plus /> Nueva categoría
        </Button>
      </EncabezadoPanel>

      {categorias.isError ? (
        <EstadoError error={categorias.error} alReintentar={() => void categorias.refetch()} />
      ) : (
        <TablaResponsiva
          etiqueta="Categorías"
          filas={categorias.data}
          claveFila={(c) => c.idCategoria}
          columnas={[
            {
              clave: 'nombre',
              titulo: 'Categoría',
              celda: (c) => (
                <span className="flex items-center gap-2">
                  <IconoCategoria nombre={c.nombre} className="size-4 text-primary" aria-hidden />
                  <span className="font-medium">{c.nombre}</span>
                </span>
              ),
            },
            {
              clave: 'descripcion',
              titulo: 'Descripción',
              soloEscritorio: true,
              celda: (c) => (
                <span className="line-clamp-1 max-w-md text-muted-foreground">{c.descripcion}</span>
              ),
            },
            {
              clave: 'productos',
              titulo: 'Productos a la venta',
              celda: (c) => c.productosActivos,
              derecha: true,
            },
            {
              clave: 'estado',
              titulo: 'Estado',
              celda: (c) =>
                c.activo ? (
                  <Badge variant="secondary">Activa</Badge>
                ) : (
                  <Badge variant="outline">Inactiva</Badge>
                ),
            },
          ]}
          acciones={(c) => (
            <>
              <Button variant="outline" size="sm" onClick={() => setDialogo({ abierto: true, categoria: c })}>
                <Pencil /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={estado.isPending}
                onClick={() => estado.mutate({ id: c.idCategoria, activo: !c.activo })}
              >
                {c.activo ? 'Desactivar' : 'Activar'}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                aria-label={`Eliminar ${c.nombre}`}
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate(c.idCategoria)}
              >
                <Trash2 />
              </Button>
            </>
          )}
          vacio={<EstadoVacio icono={FolderTree} titulo="Aún no hay categorías" />}
        />
      )}

      <DialogoCategoria
        key={dialogo.categoria?.idCategoria ?? 'nueva'}
        abierto={dialogo.abierto}
        categoria={dialogo.categoria}
        alCambiarAbierto={(abierto) => setDialogo((d) => ({ ...d, abierto }))}
      />
    </>
  );
}

function DialogoCategoria({
  abierto,
  categoria,
  alCambiarAbierto,
}: {
  abierto: boolean;
  categoria?: Categoria | undefined;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '');
  const guardar = useMutacionCatalogo(
    () => {
      const datos = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
      return categoria
        ? apiCatalogoAdmin.actualizarCategoria(categoria.idCategoria, datos)
        : apiCatalogoAdmin.crearCategoria(datos);
    },
    categoria ? 'Categoría actualizada' : 'Categoría creada',
  );

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>El nombre no puede repetirse.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="categoria-nombre">Nombre</Label>
            <Input
              id="categoria-nombre"
              value={nombre}
              maxLength={100}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="categoria-descripcion">Descripción (opcional)</Label>
            <Textarea
              id="categoria-descripcion"
              value={descripcion}
              maxLength={500}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => alCambiarAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!nombre.trim() || guardar.isPending}
            onClick={() => guardar.mutate(undefined, { onSuccess: () => alCambiarAbierto(false) })}
          >
            {guardar.isPending && <Spinner />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
