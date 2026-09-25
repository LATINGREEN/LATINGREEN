import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ProveedorAccesibilidad } from './api/accesibilidad';
import { ProveedorSesion } from './api/sesion';
import { AvisoDemo } from './demo/AvisoDemo';
import './estilos.css';

/**
 * A.2.1 — Intranet ARC, sin internet. `retry` bajo y sin reintentos infinitos:
 * si la API no responde, se avisa; no se martillea una red cerrada.
 *
 * `refetchOnWindowFocus` desactivado a propósito: con la expiración deslizante
 * de R1, una recarga al volver a la pestaña alargaría la sesión sin que nadie
 * la usara, que es exactamente lo que los diez minutos de inactividad quieren
 * evitar.
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

/*
 * La demostración se abre desde un archivo o desde una página alojada en
 * cualquier ruta: el enrutador lleva la ruta en memoria y no en la barra de
 * direcciones. La aplicación real usa la barra de direcciones.
 */
const esDemo = import.meta.env.MODE === 'demo';
const Enrutador = esDemo ? MemoryRouter : BrowserRouter;

const contenedor = document.getElementById('raiz');
if (contenedor === null) {
  throw new Error('No se encontró el elemento #raiz en index.html');
}

/*
 * El orden de los proveedores importa:
 *   - Accesibilidad va el más externo, porque fija los atributos de la raíz
 *     que leen los tokens de CSS y debe aplicar también a la pantalla de
 *     ingreso, antes de que haya sesión.
 *   - Sesión va por dentro del cliente de consultas, porque `ingresar()` y
 *     `renovar()` usan el cliente de API y el contexto de sesión invalida
 *     consultas.
 *   - El router va el más interno, para que `Navigate` pueda decidir con la
 *     sesión ya disponible.
 */
createRoot(contenedor).render(
  <React.StrictMode>
    <ProveedorAccesibilidad>
      <QueryClientProvider client={clienteConsultas}>
        <ProveedorSesion>
          <Enrutador>
            {esDemo && <AvisoDemo />}
            <App />
          </Enrutador>
        </ProveedorSesion>
      </QueryClientProvider>
    </ProveedorAccesibilidad>
  </React.StrictMode>,
);
