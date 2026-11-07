import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from '@/app/proveedores';
import { router } from '@/app/router';
import './index.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <Proveedores>
      <RouterProvider router={router} />
    </Proveedores>
  </StrictMode>,
);
