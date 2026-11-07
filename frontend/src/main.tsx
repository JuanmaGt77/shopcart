import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from '@/app/proveedores';
import { router } from '@/app/router';
import { renovarSesion } from '@/modulos/auth/almacen-sesion';
import './index.css';

// Recupera la sesión con la cookie httpOnly del refresh token (si no hay, la tienda arranca como visitante)
void renovarSesion();

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <Proveedores>
      <RouterProvider router={router} />
    </Proveedores>
  </StrictMode>,
);
