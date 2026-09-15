import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './estilos.css';

/**
 * A.2.1 — Intranet ARC, sin internet. `retry` bajo y sin reintentos infinitos:
 * si la API no responde, se avisa; no se martillea la red cerrada.
 */
const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const contenedor = document.getElementById('raiz');
if (contenedor === null) {
  throw new Error('No se encontró el elemento #raiz en index.html');
}

createRoot(contenedor).render(
  <React.StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
