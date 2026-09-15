import { useEffect, useRef, useState } from 'react';
import { CAJA_COLOMBIA, estaEnColombia } from '@paid/schema';
import type { CoordenadaDecimal } from '@paid/schema';
import { Alerta, Mapa } from './Iconos';

/**
 * «Ver ubicación» (Fase 4, punto 5).
 *
 * ⚠️ Q11 SIN RESPONDER. MapLibre sin teselas no dibuja nada, y no puede
 * traerlas de internet (A.2.1). Hay dos caminos posibles y la decisión es de
 * JACID: consumir el WMS/WMTS institucional si existe, o empaquetar un PMTiles
 * con el extracto de Colombia servido por el propio despliegue.
 *
 * Mientras eso se responda, este componente NO muestra un cuadro en blanco. Un
 * mapa vacío sin explicación es peor que no tener mapa: el usuario cree que el
 * punto está mal. En su lugar dibuja una CARTA ESQUEMÁTICA: la retícula de
 * grados, la caja del territorio colombiano y el punto en su posición relativa,
 * con las coordenadas en claro. No es cartografía, y lo dice; pero permite
 * verificar de un vistazo que el punto cae donde debe.
 *
 * Si `VITE_TESELAS_URL` está configurada, se carga MapLibre de verdad —de forma
 * diferida, para no arrastrar la biblioteca a quien no tiene teselas.
 */

export interface MapaUbicacionProps {
  readonly punto: CoordenadaDecimal;
  readonly etiqueta?: string;
}

const URL_TESELAS = import.meta.env['VITE_TESELAS_URL'] as string | undefined;

export function MapaUbicacion({ punto, etiqueta }: MapaUbicacionProps): JSX.Element {
  const hayTeselas = URL_TESELAS !== undefined && URL_TESELAS !== '';
  return hayTeselas ? (
    <MapaConTeselas punto={punto} {...(etiqueta !== undefined ? { etiqueta } : {})} />
  ) : (
    <CartaEsquematica punto={punto} {...(etiqueta !== undefined ? { etiqueta } : {})} />
  );
}

/**
 * Carta esquemática. Sin cartografía, pero con la información que permite
 * comprobar el punto: su posición dentro del territorio y sus coordenadas.
 */
function CartaEsquematica({ punto, etiqueta }: MapaUbicacionProps): JSX.Element {
  const dentro = estaEnColombia(punto);

  // Se proyecta el punto en la caja de Colombia, con un margen para que un
  // punto en el borde siga siendo visible.
  const anchoGrados = CAJA_COLOMBIA.longitudMaxima - CAJA_COLOMBIA.longitudMinima;
  const altoGrados = CAJA_COLOMBIA.latitudMaxima - CAJA_COLOMBIA.latitudMinima;
  const x = ((punto.longitud - CAJA_COLOMBIA.longitudMinima) / anchoGrados) * 100;
  const y = ((CAJA_COLOMBIA.latitudMaxima - punto.latitud) / altoGrados) * 100;
  const xAcotado = Math.max(2, Math.min(98, x));
  const yAcotado = Math.max(2, Math.min(98, y));

  return (
    <div className="carta">
      <div className="carta-lienzo" role="img"
        aria-label={
          `Ubicación aproximada: latitud ${punto.latitud.toFixed(6)}, ` +
          `longitud ${punto.longitud.toFixed(6)}. ` +
          (dentro ? 'Dentro del territorio colombiano.' : 'FUERA del territorio colombiano.')
        }
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="carta-svg">
          {/* Retícula de grados */}
          <defs>
            <pattern id="reticula" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0H0v10" fill="none" className="carta-reticula" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#reticula)" />
          {/* El punto, con su círculo de alcance */}
          <circle cx={xAcotado} cy={yAcotado} r="7" className="carta-halo" />
          <circle cx={xAcotado} cy={yAcotado} r="2.2" className="carta-punto" />
          {/* Retículas de puntería, como en una carta */}
          <line x1="0" y1={yAcotado} x2="100" y2={yAcotado} className="carta-mira" />
          <line x1={xAcotado} y1="0" x2={xAcotado} y2="100" className="carta-mira" />
        </svg>
        <span className="carta-sello rotulo">Carta esquemática</span>
      </div>

      <dl className="carta-datos">
        <div>
          <dt className="rotulo">Latitud</dt>
          <dd className="datos">{punto.latitud.toFixed(6)}°</dd>
        </div>
        <div>
          <dt className="rotulo">Longitud</dt>
          <dd className="datos">{punto.longitud.toFixed(6)}°</dd>
        </div>
        {etiqueta !== undefined && (
          <div>
            <dt className="rotulo">Lugar</dt>
            <dd>{etiqueta}</dd>
          </div>
        )}
      </dl>

      {!dentro && (
        <div className="aviso aviso-ojo">
          <span className="aviso-icono">
            <Alerta tamano={17} />
          </span>
          <p>
            El punto cae <strong>fuera del territorio colombiano</strong>. Puede ser
            correcto —una comisión en el exterior, un ejercicio binacional— pero
            conviene revisar los grados antes de guardar.
          </p>
        </div>
      )}

      <div className="aviso aviso-info">
        <span className="aviso-icono">
          <Mapa tamano={17} />
        </span>
        <p>
          Cartografía no disponible en este despliegue. Se muestra la posición
          relativa y las coordenadas. <span className="carta-todo">TODO(JACID) Q11</span>:
          falta definir si se consume el servicio cartográfico institucional
          (WMS/WMTS) o se empaqueta un archivo de teselas propio.
        </p>
      </div>
    </div>
  );
}

/**
 * Mapa real con MapLibre. La biblioteca se importa de forma DIFERIDA: solo
 * quien tiene teselas configuradas paga sus ~800 KB, y en una red cerrada con
 * un `node_modules` transportado eso importa.
 */
function MapaConTeselas({ punto, etiqueta }: MapaUbicacionProps): JSX.Element {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let mapa: { remove: () => void } | null = null;
    let cancelado = false;

    void (async () => {
      try {
        const [maplibre, { Protocol }] = await Promise.all([
          import('maplibre-gl'),
          import('pmtiles'),
        ]);
        if (cancelado || contenedor.current === null) return;

        // PMTiles se registra como protocolo para que el estilo pueda
        // referenciar `pmtiles://…` servido por el propio backend.
        maplibre.addProtocol('pmtiles', new Protocol().tile);

        mapa = new maplibre.Map({
          container: contenedor.current,
          style: URL_TESELAS as string,
          center: [punto.longitud, punto.latitud],
          zoom: 11,
          attributionControl: false,
        });
        new maplibre.Marker()
          .setLngLat([punto.longitud, punto.latitud])
          .addTo(mapa as never);
      } catch (error: unknown) {
        // Degradación limpia: si el mapa no carga, la pantalla sigue en pie.
        if (!cancelado) {
          setFallo(error instanceof Error ? error.message : 'No se pudo cargar el mapa.');
        }
      }
    })();

    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [punto.latitud, punto.longitud]);

  if (fallo !== null) {
    return (
      <>
        <div className="aviso aviso-ojo">
          <span className="aviso-icono"><Alerta tamano={17} /></span>
          <p>No se pudo cargar la cartografía. Se muestran las coordenadas.</p>
        </div>
        <CartaEsquematica punto={punto} {...(etiqueta !== undefined ? { etiqueta } : {})} />
      </>
    );
  }

  return <div ref={contenedor} className="mapa-real" />;
}
