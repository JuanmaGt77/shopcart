import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { finDelDia, hoyGuatemala, inicioDelDia } from '@/lib/fechas';
import { useCategorias } from '@/modulos/catalogo/consultas';
import { apiCupones, useMutacionCupon, type Cupon, type DatosCupon } from './api';

/** AAAA-MM-DD del día de Guatemala de una fecha UTC. */
const diaDe = (iso: string) => hoyGuatemala(new Date(iso));
const numeroOpcional = (texto: string) => (texto.trim() === '' ? null : Number(texto));

/** Alta y edición de cupones. Las reglas (vigencia, mínimos, topes, límites) las vuelve a validar la API. */
export function DialogoCupon({
  abierto,
  cupon,
  alCambiarAbierto,
}: {
  abierto: boolean;
  cupon?: Cupon | undefined;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const { data: categorias } = useCategorias(true);
  const [f, setF] = useState({
    codigo: cupon?.codigo ?? '',
    descripcion: cupon?.descripcion ?? '',
    tipo: cupon?.tipoDescuento ?? ('PORCENTAJE' as const),
    valor: cupon?.valor.toString() ?? '',
    minimo: cupon?.montoMinimo.toString() ?? '0',
    tope: cupon?.descuentoMaximo?.toString() ?? '',
    idCategoria: cupon?.idCategoria?.toString() ?? 'todas',
    desde: cupon ? diaDe(cupon.fechaInicio) : hoyGuatemala(),
    hasta: cupon ? diaDe(cupon.fechaFin) : '',
    limiteTotal: cupon?.limiteUsosTotal?.toString() ?? '',
    limiteCliente: cupon?.limiteUsosPorCliente?.toString() ?? '',
  });
  const set = (campo: keyof typeof f) => (valor: string) => setF({ ...f, [campo]: valor });

  const valor = Number(f.valor);
  const errores = [
    !cupon &&
      !/^[A-Z0-9_-]{3,30}$/.test(f.codigo) &&
      'El código admite letras, números, guion y guion bajo (3 a 30).',
    !(valor > 0) && 'El valor del descuento debe ser mayor a cero.',
    f.tipo === 'PORCENTAJE' && valor > 100 && 'Un porcentaje no puede ser mayor a 100.',
    (!f.desde || !f.hasta || f.hasta < f.desde) &&
      'Indica la vigencia: el fin debe ser igual o posterior al inicio.',
  ].filter(Boolean) as string[];

  const guardar = useMutacionCupon(
    () => {
      const datos: DatosCupon = {
        codigo: f.codigo,
        descripcion: f.descripcion.trim() || null,
        tipoDescuento: f.tipo,
        valor,
        montoMinimo: Number(f.minimo) || 0,
        descuentoMaximo: numeroOpcional(f.tope),
        idCategoria: f.idCategoria === 'todas' ? null : Number(f.idCategoria),
        fechaInicio: inicioDelDia(f.desde) ?? '',
        fechaFin: finDelDia(f.hasta) ?? '',
        limiteUsosTotal: numeroOpcional(f.limiteTotal),
        limiteUsosPorCliente: numeroOpcional(f.limiteCliente),
      };
      return cupon ? apiCupones.actualizar(cupon.idCupon, datos) : apiCupones.crear(datos);
    },
    (c) => `Cupón ${c.codigo} guardado`,
  );

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cupon ? `Editar ${cupon.codigo}` : 'Nuevo cupón'}</DialogTitle>
          <DialogDescription>
            Aplica solo a productos (no al envío). Las fechas son días completos en hora de Guatemala.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {!cupon && (
            <div className="grid gap-1.5">
              <Label htmlFor="cupon-codigo">Código</Label>
              <Input
                id="cupon-codigo"
                className="font-mono uppercase"
                value={f.codigo}
                maxLength={30}
                onChange={(e) => set('codigo')(e.target.value.toUpperCase())}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="cupon-descripcion">Descripción (opcional)</Label>
            <Input
              id="cupon-descripcion"
              value={f.descripcion}
              maxLength={200}
              onChange={(e) => set('descripcion')(e.target.value)}
            />
          </div>
          <RadioGroup value={f.tipo} onValueChange={(v) => set('tipo')(v)} className="grid-cols-2">
            <Label
              htmlFor="tipo-porcentaje"
              className="flex items-center gap-2 rounded-lg border p-3 font-normal"
            >
              <RadioGroupItem value="PORCENTAJE" id="tipo-porcentaje" /> Porcentaje (%)
            </Label>
            <Label htmlFor="tipo-monto" className="flex items-center gap-2 rounded-lg border p-3 font-normal">
              <RadioGroupItem value="MONTO" id="tipo-monto" /> Monto fijo (Q)
            </Label>
          </RadioGroup>
          <div className="grid grid-cols-3 gap-3">
            <Campo
              id="cupon-valor"
              etiqueta={f.tipo === 'PORCENTAJE' ? 'Valor (%)' : 'Valor (Q)'}
              valor={f.valor}
              alCambiar={set('valor')}
            />
            <Campo
              id="cupon-minimo"
              etiqueta="Compra mínima (Q)"
              valor={f.minimo}
              alCambiar={set('minimo')}
            />
            <Campo id="cupon-tope" etiqueta="Tope (Q, opcional)" valor={f.tope} alCambiar={set('tope')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cupon-categoria">Solo para la categoría</Label>
            <Select value={f.idCategoria} onValueChange={set('idCategoria')}>
              <SelectTrigger id="cupon-categoria" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todo el carrito</SelectItem>
                {categorias?.map((c) => (
                  <SelectItem key={c.idCategoria} value={String(c.idCategoria)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="cupon-desde" etiqueta="Desde" tipo="date" valor={f.desde} alCambiar={set('desde')} />
            <Campo id="cupon-hasta" etiqueta="Hasta" tipo="date" valor={f.hasta} alCambiar={set('hasta')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              id="cupon-total"
              etiqueta="Usos en total (opcional)"
              valor={f.limiteTotal}
              alCambiar={set('limiteTotal')}
            />
            <Campo
              id="cupon-cliente"
              etiqueta="Usos por cliente (opcional)"
              valor={f.limiteCliente}
              alCambiar={set('limiteCliente')}
            />
          </div>
          {errores.length > 0 && (
            <ul className="space-y-1 text-xs text-destructive">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => alCambiarAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={errores.length > 0 || guardar.isPending}
            onClick={() => guardar.mutate(undefined, { onSuccess: () => alCambiarAbierto(false) })}
          >
            {guardar.isPending && <Spinner />} Guardar cupón
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  id,
  etiqueta,
  valor,
  alCambiar,
  tipo = 'number',
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  tipo?: 'number' | 'date';
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {etiqueta}
      </Label>
      <Input
        id={id}
        type={tipo}
        min={tipo === 'number' ? 0 : undefined}
        step={tipo === 'number' ? 'any' : undefined}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
      />
    </div>
  );
}
