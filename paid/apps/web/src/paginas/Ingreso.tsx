import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MENSAJE_CREDENCIALES_INVALIDAS } from '@paid/schema';
import type { RetoCaptcha } from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { ControlesAccesibilidad } from '../componentes/ControlesAccesibilidad';
import { Alerta, Ancla, Brujula } from '../componentes/Iconos';

/**
 * Pantalla de ingreso.
 *
 * ⚠️ R4 gobierna esta pantalla entera. La base distingue OCHO causas de fallo
 * para el análisis forense —clave inválida, usuario inexistente, captcha
 * inválido, usuario bloqueado, usuario inactivo, red no autorizada, clave
 * expirada— y **la pantalla siempre dice lo mismo**: «Credenciales inválidas».
 *
 * Por eso aquí no hay lógica que distinga casos. Hay un solo mensaje, y viene
 * del servidor ya redactado. Si alguien añade «el usuario está bloqueado»
 * pensando que ayuda al usuario, estará informando a quien prueba credenciales
 * de cuáles existen.
 *
 * R3 — Cada ingreso exige un captcha nuevo, de un solo uso. Si el ingreso
 * falla, el reto ya se consumió (se marca consumido con independencia del
 * resultado), así que hay que pedir otro. Eso se hace solo.
 */
export function Ingreso(): JSX.Element {
  const { ingresar, cargando } = useSesion();
  const clienteConsultas = useQueryClient();
  const [credencial, setCredencial] = useState('');
  const [clave, setClave] = useState('');
  const [respuestaCaptcha, setRespuestaCaptcha] = useState('');
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const reto = useQuery({
    queryKey: ['captcha'],
    queryFn: () => api.crear<RetoCaptcha>('/autenticacion/reto', {}),
    // El reto caduca a los 5 minutos (R3): no tiene sentido reutilizar uno
    // viejo de la caché.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const entrar = useMutation({
    mutationFn: async () => {
      if (reto.data === undefined) throw new Error('Sin captcha');
      await ingresar({
        credencial,
        clave,
        idCaptcha: reto.data.idCaptcha,
        respuestaCaptcha,
      });
    },
    onError: (error: unknown) => {
      // Un mensaje único, sea cual sea la causa (R4). Si el servidor no
      // respondió, ese sí se distingue: es un problema de red, no de
      // credenciales, y decirle «credenciales inválidas» a quien no tiene
      // conexión lo manda a cambiar su clave sin motivo.
      if (error instanceof ErrorApi && error.codigo === 'RED_SIN_RESPUESTA') {
        setMensajeError(error.message);
      } else {
        setMensajeError(MENSAJE_CREDENCIALES_INVALIDAS);
      }
      setClave('');
      setRespuestaCaptcha('');
      // R3: el reto ya se consumió. Se pide otro.
      void clienteConsultas.invalidateQueries({ queryKey: ['captcha'] });
    },
  });

  // Al aparecer un error, se lleva el foco al aviso para que un lector de
  // pantalla lo lea sin que la persona tenga que ir a buscarlo.
  useEffect(() => {
    if (mensajeError !== null) {
      document.getElementById('aviso-ingreso')?.focus();
    }
  }, [mensajeError]);

  const listo =
    credencial.trim() !== '' && clave !== '' && respuestaCaptcha.trim() !== '' &&
    reto.data !== undefined;

  return (
    <div className="ingreso">
      <div className="ingreso-acc">
        <ControlesAccesibilidad />
      </div>

      <div className="ingreso-panel tarjeta-vidrio emerge">
        <header className="ingreso-marca">
          <span className="ingreso-ancla" aria-hidden="true">
            <Ancla tamano={30} />
          </span>
          <div>
            <h1>PAID</h1>
            <p className="ingreso-institucion">
              Plataforma de Acción Integral y Desarrollo
              <br />
              <strong>Armada de Colombia</strong>
            </p>
          </div>
        </header>

        {mensajeError !== null && (
          <div
            className="aviso aviso-mal"
            id="aviso-ingreso"
            role="alert"
            tabIndex={-1}
          >
            <span className="aviso-icono">
              <Alerta tamano={18} />
            </span>
            <p>{mensajeError}</p>
          </div>
        )}

        {/* Sin <form>: el envío se maneja en el botón y con Enter en los
            campos, lo que evita un recargo de página accidental. */}
        <div className="columna" style={{ gap: 'var(--e-4)' }}>
          <div className="campo">
            <label htmlFor="credencial">
              Credencial de unidad<span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <input
              id="credencial"
              className="entrada datos"
              value={credencial}
              onChange={(e) => setCredencial(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && listo) entrar.mutate();
              }}
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="BIM23_PAID"
              required
              aria-describedby="ayuda-credencial"
            />
            {/* R5 — la credencial es de la UNIDAD, no de la persona. Decirlo
                aquí evita que alguien busque su nombre. */}
            <p className="ayuda" id="ayuda-credencial">
              Es la credencial de la unidad, no personal. Sigue el patrón
              <code> SIGLA_PAID</code>.
            </p>
          </div>

          <div className="campo">
            <label htmlFor="clave">
              Contraseña<span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <input
              id="clave"
              type="password"
              className="entrada"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && listo) entrar.mutate();
              }}
              autoComplete="current-password"
              required
            />
          </div>

          {/* R3 — captcha de un solo uso en cada ingreso. */}
          <div className="campo">
            <label htmlFor="captcha">
              Verificación<span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <div className="captcha">
              <div className="captcha-reto" aria-live="polite">
                {reto.isPending && <span className="esqueleto captcha-esqueleto" />}
                {reto.isError && (
                  <span className="captcha-error">No se pudo obtener la verificación.</span>
                )}
                {reto.data !== undefined && (
                  <span className="captcha-texto datos">{reto.data.textoReto}</span>
                )}
              </div>
              <input
                id="captcha"
                className="entrada datos captcha-entrada"
                value={respuestaCaptcha}
                onChange={(e) => setRespuestaCaptcha(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && listo) entrar.mutate();
                }}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                required
                aria-describedby="ayuda-captcha"
              />
            </div>
            {/* El captcha es aritmético y no una imagen: una imagen sin
                alternativa textual incumpliría WCAG 2.1 AA. */}
            <p className="ayuda" id="ayuda-captcha">
              Resuelva la operación. Cada ingreso exige una verificación nueva.
            </p>
          </div>

          <button
            type="button"
            className="boton boton-primario ingreso-boton"
            disabled={!listo || cargando || entrar.isPending}
            onClick={() => entrar.mutate()}
          >
            {cargando || entrar.isPending ? 'Verificando…' : 'Ingresar'}
          </button>
        </div>

        <footer className="ingreso-pie">
          <p className="fila" style={{ gap: 'var(--e-2)' }}>
            <Brujula tamano={15} />
            <span>
              La sesión se cierra tras <strong>10 minutos</strong> de inactividad.
            </span>
          </p>
          <p className="ingreso-clasificacion">
            Intranet ARC · Información Público Clasificado
          </p>
        </footer>
      </div>
    </div>
  );
}
