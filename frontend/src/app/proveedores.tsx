import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorApi } from '@/api/cliente';

function crearClienteQuery(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Los datos se refrescan por WebSocket; no hace falta volver a pedirlos en cada foco de ventana
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Un 4xx no se arregla reintentando (permiso, validación, no existe): solo se reintentan fallas de red o 5xx
        retry: (intentos, error) => !(error instanceof ErrorApi && error.estado < 500) && intentos < 2,
      },
    },
  });
}

export function Proveedores({ children }: { children: ReactNode }) {
  const [clienteQuery] = useState(crearClienteQuery);

  return (
    <QueryClientProvider client={clienteQuery}>
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-center" />
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
