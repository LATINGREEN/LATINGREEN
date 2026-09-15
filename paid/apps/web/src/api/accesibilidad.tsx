import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Controles de contraste y tamaño de letra.
 *
 * La Fase 4 los exige: «el manual muestra controles de contraste y tamaño de
 * letra. Impleméntalos y cumple WCAG 2.1 AA — a una entidad pública
 * colombiana le aplican los lineamientos de accesibilidad del MinTIC
 * (Resolución 1519 de 2020)».
 *
 * La preferencia se guarda en `localStorage`, y aquí SÍ es correcto —al
 * contrario que el testigo de sesión—: es una preferencia de la persona que
 * usa ese equipo, no una credencial. Que sobreviva al cierre del navegador es
 * justamente lo que se quiere; volver a subir la letra en cada ingreso sería
 * un impuesto diario para quien la necesita.
 *
 * El acceso va en try/catch: en una sesión privada o con el almacenamiento
 * bloqueado, `localStorage` lanza, y la interfaz tiene que seguir funcionando
 * con los valores por omisión.
 */

export const CONTRASTES = ['normal', 'claro', 'alto'] as const;
export const LETRAS = ['normal', 'grande', 'mayor'] as const;

export type Contraste = (typeof CONTRASTES)[number];
export type Letra = (typeof LETRAS)[number];

export const ETIQUETA_CONTRASTE: Record<Contraste, string> = {
  normal: 'Carta nocturna',
  claro: 'Claro',
  alto: 'Alto contraste',
};

export const ETIQUETA_LETRA: Record<Letra, string> = {
  normal: 'Normal',
  grande: 'Grande',
  mayor: 'Mayor',
};

interface EstadoAccesibilidad {
  readonly contraste: Contraste;
  readonly letra: Letra;
  readonly fijarContraste: (valor: Contraste) => void;
  readonly fijarLetra: (valor: Letra) => void;
}

const Contexto = createContext<EstadoAccesibilidad | null>(null);
const CLAVE = 'paid.accesibilidad';

function leerGuardado(): { contraste: Contraste; letra: Letra } {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (crudo === null) return { contraste: 'normal', letra: 'normal' };
    const datos = JSON.parse(crudo) as { contraste?: string; letra?: string };
    return {
      contraste: (CONTRASTES as readonly string[]).includes(datos.contraste ?? '')
        ? (datos.contraste as Contraste)
        : 'normal',
      letra: (LETRAS as readonly string[]).includes(datos.letra ?? '')
        ? (datos.letra as Letra)
        : 'normal',
    };
  } catch {
    return { contraste: 'normal', letra: 'normal' };
  }
}

export function ProveedorAccesibilidad({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const inicial = leerGuardado();
  const [contraste, setContraste] = useState<Contraste>(inicial.contraste);
  const [letra, setLetra] = useState<Letra>(inicial.letra);

  // Los tokens de tokens.css leen estos atributos de la raíz.
  useEffect(() => {
    document.documentElement.setAttribute('data-contraste', contraste);
    document.documentElement.setAttribute('data-letra', letra);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify({ contraste, letra }));
    } catch {
      // Sin almacenamiento la preferencia no persiste, pero la sesión en curso
      // funciona igual. No es motivo para romper nada.
    }
  }, [contraste, letra]);

  const valor = useMemo<EstadoAccesibilidad>(
    () => ({
      contraste,
      letra,
      fijarContraste: setContraste,
      fijarLetra: setLetra,
    }),
    [contraste, letra],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAccesibilidad(): EstadoAccesibilidad {
  const valor = useContext(Contexto);
  if (valor === null) {
    throw new Error('useAccesibilidad debe usarse dentro de ProveedorAccesibilidad.');
  }
  return valor;
}

/** Anuncio para lectores de pantalla, sin mover el foco. */
export function useAnuncio(): (mensaje: string) => void {
  const [, setMensaje] = useState('');
  return useCallback((mensaje: string) => {
    setMensaje(mensaje);
    const region = document.getElementById('anuncios');
    if (region !== null) {
      // Se limpia y se vuelve a escribir para que el lector lo repita aunque
      // el texto sea idéntico al anterior.
      region.textContent = '';
      window.setTimeout(() => {
        region.textContent = mensaje;
      }, 60);
    }
  }, []);
}
