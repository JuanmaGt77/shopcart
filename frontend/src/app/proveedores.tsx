import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { ErrorApi } from '@/api/cliente';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ObservadorSesion } from '@/modulos/auth/componentes/observador-sesion';
import { SincronizadorTiempoReal } from '@/tiempo-real/sincronizador';

function crearClienteQuery(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Los cambios llegan por WebSocket; no hace falta volver a pedir todo en cada foco de ventana
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Un 4xx no se arregla reintentando (permiso, validación, no existe): solo fallas de red o 5xx
        retry: (intentos, error) =>
          !(error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) && intentos < 2,
      },
    },
  });
}

export function Proveedores({ children }: { children: ReactNode }) {
  const [clienteQuery] = useState(crearClienteQuery);

  return (
    <QueryClientProvider client={clienteQuery}>
      <TooltipProvider>
        <ObservadorSesion />
        <SincronizadorTiempoReal />
        {children}
        <Toaster richColors position="top-center" closeButton />
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
