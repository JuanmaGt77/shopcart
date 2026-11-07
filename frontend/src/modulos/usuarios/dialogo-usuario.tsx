import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { pedir } from '@/api/cliente';
import { PREFIJO } from '@/api/claves';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { mensajeDeError } from '@/lib/errores';
import { NOMBRE_ROL, ROLES, type Rol, type Usuario } from '@/modulos/auth/tipos';

/** Mismas reglas de contraseña que el registro (auth.esquemas.ts). */
const contrasenaValida = (c: string) => c.length >= 8 && /[a-z]/.test(c) && /[A-Z]/.test(c) && /\d/.test(c);
const telefonoValido = (t: string) => t.trim() === '' || /^[0-9 +-]{8,20}$/.test(t.trim());

export function DialogoUsuario({
  abierto,
  usuario,
  alCambiarAbierto,
}: {
  abierto: boolean;
  usuario?: Usuario | undefined;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const cliente = useQueryClient();
  const [f, setF] = useState({
    correo: usuario?.correo ?? '',
    contrasena: '',
    nombres: usuario?.nombres ?? '',
    apellidos: usuario?.apellidos ?? '',
    telefono: usuario?.telefono ?? '',
    rol: usuario?.rol ?? ('OPERADOR' as Rol),
  });
  const set = (campo: keyof typeof f) => (valor: string) => setF({ ...f, [campo]: valor });

  const errores = [
    !usuario && !/^\S+@\S+\.\S+$/.test(f.correo.trim()) && 'Escribe un correo válido.',
    !usuario &&
      !contrasenaValida(f.contrasena) &&
      'La contraseña necesita 8 caracteres, mayúscula, minúscula y número.',
    (!f.nombres.trim() || !f.apellidos.trim()) && 'Nombres y apellidos son obligatorios.',
    !telefonoValido(f.telefono) && 'El teléfono debe tener al menos 8 dígitos.',
  ].filter(Boolean) as string[];

  const guardar = useMutation({
    mutationFn: () => {
      const telefono = f.telefono.trim() || null;
      return usuario
        ? pedir<Usuario>(`/usuarios/${usuario.idUsuario}`, {
            metodo: 'PUT',
            cuerpo: { nombres: f.nombres.trim(), apellidos: f.apellidos.trim(), telefono, rol: f.rol },
          })
        : pedir<Usuario>('/usuarios', {
            metodo: 'POST',
            cuerpo: {
              correo: f.correo.trim(),
              contrasena: f.contrasena,
              nombres: f.nombres.trim(),
              apellidos: f.apellidos.trim(),
              telefono: telefono ?? undefined,
              rol: f.rol,
            },
          });
    },
    onSuccess: (u) => {
      toast.success(usuario ? 'Usuario actualizado' : `Se creó la cuenta de ${u.nombres}`);
      void cliente.invalidateQueries({ queryKey: [PREFIJO.usuarios] });
      alCambiarAbierto(false);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{usuario ? `Editar a ${usuario.nombres}` : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {usuario
              ? usuario.correo
              : 'Para crear cuentas del personal (operador o administrador) o de clientes.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {!usuario && (
            <>
              <Campo
                id="usuario-correo"
                etiqueta="Correo"
                tipo="email"
                valor={f.correo}
                alCambiar={set('correo')}
              />
              <Campo
                id="usuario-contrasena"
                etiqueta="Contraseña temporal"
                tipo="password"
                valor={f.contrasena}
                alCambiar={set('contrasena')}
              />
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo id="usuario-nombres" etiqueta="Nombres" valor={f.nombres} alCambiar={set('nombres')} />
            <Campo
              id="usuario-apellidos"
              etiqueta="Apellidos"
              valor={f.apellidos}
              alCambiar={set('apellidos')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              id="usuario-telefono"
              etiqueta="Teléfono (opcional)"
              tipo="tel"
              valor={f.telefono}
              alCambiar={set('telefono')}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="usuario-rol">Rol</Label>
              <Select value={f.rol} onValueChange={set('rol')}>
                <SelectTrigger id="usuario-rol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {NOMBRE_ROL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {usuario && usuario.rol !== f.rol && (
            <p className="text-xs text-muted-foreground">
              El cambio de rol aplica desde su siguiente acción en el sistema.
            </p>
          )}
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
          <Button disabled={errores.length > 0 || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending && <Spinner />} Guardar
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
  tipo = 'text',
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  tipo?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} type={tipo} value={valor} onChange={(e) => alCambiar(e.target.value)} />
    </div>
  );
}
