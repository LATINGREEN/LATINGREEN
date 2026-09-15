import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { RespuestaIngreso, SolicitudIngreso } from '@paid/schema';
import { alVencerSesion, api, fijarTestigo } from './cliente';

/**
 * Estado de la sesión.
 *
 * ⚠️ R1 — Diez minutos de inactividad, expiración DESLIZANTE, evaluada EN EL
 * SERVIDOR. Este contexto NO decide cuándo vence la sesión: el servidor lo
 * hace, y aquí solo se refleja. La diferencia importa: si el cliente
 * «decidiera», bastaría con cambiar la hora del equipo.
 *
 * Lo que sí hace el cliente es AVISAR a los 8 minutos, con opción de renovar
 * (Fase 4, punto 1). El aviso se calcula de `expiraEnUtc`, que viene del
 * servidor en cada respuesta.
 *
 * El testigo vive en memoria y NO en `localStorage`. Es deliberado: un testigo
 * en almacenamiento del navegador sobrevive al cierre de la pestaña, y en un
 * equipo compartido —lo habitual en una unidad— eso es una sesión abierta que
 * nadie cerró. R1 quiere lo contrario.
 */

export interface EstadoSesion {
  readonly sesion: RespuestaIngreso | null;
  readonly cargando: boolean;
  /** Segundos que faltan para que la sesión venza, según el servidor. */
  readonly segundosRestantes: number;
  /** ¿Toca avisar? (a los 8 de los 10 minutos) */
  readonly avisarExpiracion: boolean;
  readonly ingresar: (solicitud: SolicitudIngreso) => Promise<void>;
  readonly salir: () => Promise<void>;
  /** Renueva la sesión con una petición real: el servidor desplaza el TTL. */
  readonly renovar: () => Promise<void>;
  readonly puede: (permiso: string) => boolean;
}

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { readonly children: ReactNode }): JSX.Element {
  const [sesion, setSesion] = useState<RespuestaIngreso | null>(null);
  const [cargando, setCargando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  // Un tic por segundo, solo mientras haya sesión. Sin sesión no hay nada que
  // contar y un intervalo colgado es una fuga.
  useEffect(() => {
    if (sesion === null) return;
    const tic = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(tic);
  }, [sesion]);

  // Si el servidor responde 401, la sesión se cayó: se limpia sin preguntar.
  useEffect(
    () =>
      alVencerSesion(() => {
        setSesion(null);
        fijarTestigo(null);
      }),
    [],
  );

  const ingresar = useCallback(async (solicitud: SolicitudIngreso) => {
    setCargando(true);
    try {
      const respuesta = await api.crear<RespuestaIngreso>('/autenticacion/ingreso', solicitud);
      fijarTestigo(respuesta.testigo);
      setSesion(respuesta);
      setAhora(Date.now());
    } finally {
      setCargando(false);
    }
  }, []);

  const salir = useCallback(async () => {
    try {
      await api.crear<void>('/autenticacion/salida', {});
    } finally {
      // Se limpia aunque la petición falle: si el servidor no responde, la
      // sesión de este navegador se cierra igual. Dejarla abierta «porque el
      // cierre falló» sería lo peor de los dos mundos.
      fijarTestigo(null);
      setSesion(null);
    }
  }, []);

  const renovar = useCallback(async () => {
    /*
     * Cualquier petición autenticada desplaza el TTL: es lo que hace la
     * expiración deslizante de R1. Se usa la sonda de permisos propios porque
     * es la más liviana y no modifica nada.
     */
    const salud = await api.obtener<{ expiraEnUtc?: string }>('/autenticacion/sesion');
    setSesion((anterior) =>
      anterior === null || salud.expiraEnUtc === undefined
        ? anterior
        : { ...anterior, expiraEnUtc: salud.expiraEnUtc },
    );
    setAhora(Date.now());
  }, []);

  const segundosRestantes = useMemo(() => {
    if (sesion === null) return 0;
    const vence = new Date(sesion.expiraEnUtc).getTime();
    return Math.max(0, Math.round((vence - ahora) / 1000));
  }, [sesion, ahora]);

  const avisarExpiracion = useMemo(() => {
    if (sesion === null) return false;
    // Avisa cuando falta menos de lo que separa el aviso de la expiración.
    const margen = 600 - sesion.avisoEnSegundos; // 120 s con los valores fijados
    return segundosRestantes > 0 && segundosRestantes <= margen;
  }, [sesion, segundosRestantes]);

  const puede = useCallback(
    (permiso: string) => sesion !== null && sesion.permisos.includes(permiso),
    [sesion],
  );

  const valor = useMemo<EstadoSesion>(
    () => ({
      sesion,
      cargando,
      segundosRestantes,
      avisarExpiracion,
      ingresar,
      salir,
      renovar,
      puede,
    }),
    [sesion, cargando, segundosRestantes, avisarExpiracion, ingresar, salir, renovar, puede],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): EstadoSesion {
  const valor = useContext(Contexto);
  if (valor === null) {
    throw new Error('useSesion debe usarse dentro de ProveedorSesion.');
  }
  return valor;
}
