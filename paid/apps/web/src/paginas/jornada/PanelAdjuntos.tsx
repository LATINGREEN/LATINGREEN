import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  EXTENSIONES_POR_CATEGORIA,
  FASES_DOCUMENTALES,
  SOPORTES_POR_FASE_JORNADA,
  extensionDe,
  extensionPermitida,
  formatearBytes,
  formatearFechaDdMmAaaa,
} from '@paid/schema';
import type { AdjuntoEnListado, EstadoCuota } from '@paid/schema';
import { ErrorApi, api, descargarArchivo } from '../../api/cliente';
import { useAnuncio } from '../../api/accesibilidad';
import { MedidorCuota } from '../../componentes/MedidorCuota';
import { Adjuntar, Alerta, Cruz, Descargar, Info } from '../../componentes/Iconos';

/**
 * Archivos adjuntos: R11 y R12 en pantalla.
 *
 * ── Lo que cambió ───────────────────────────────────────────────────────────
 *
 * 1. **Los soportes adjuntados se listan**, con descarga y baja. Antes, tras
 *    subir un archivo no quedaba rastro en la pantalla: solo se movía el
 *    medidor de cuota.
 *
 * 2. **Se avisa ANTES de subir** si el archivo no cabe o su extensión no está
 *    permitida. R11 pide mostrar el consumo antes de intentar; esto va un paso
 *    más allá y compara con el archivo elegido. No sustituye la comprobación
 *    del servidor —que además lee el contenido real (R12)—: evita esperar una
 *    subida de 9 MB para enterarse de que no cabía.
 *
 * 3. **La fase documental ya no viene elegida.** Venía en «Fase 1», y como el
 *    significado de las fases está sin confirmar (Q7), un valor por omisión
 *    es un dato que nadie eligió en cada soporte que se sube.
 */

const EXTENSIONES = Object.values(EXTENSIONES_POR_CATEGORIA).flat();

const CATEGORIAS = [
  { categoria: 'IMAGEN', titulo: 'Imágenes' },
  { categoria: 'DOCUMENTO', titulo: 'Documentos' },
  { categoria: 'AUDIO', titulo: 'Audios' },
  { categoria: 'VIDEO', titulo: 'Videos' },
] as const;

export function PanelAdjuntos({
  idJornada,
  cuota,
  puedeCargar,
  alCambiar,
  siguientePendiente,
  irA,
}: {
  readonly idJornada: number;
  readonly cuota: (EstadoCuota & { cuotaTotalBytes: number }) | undefined;
  readonly puedeCargar: boolean;
  readonly alCambiar: () => void;
  readonly siguientePendiente: string | null;
  readonly irA: (pestana: string) => void;
}): JSX.Element {
  const anunciar = useAnuncio();
  const entrada = useRef<HTMLInputElement | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fase, setFase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<number | null>(null);

  const adjuntos = useQuery({
    queryKey: ['jornada-adjuntos', idJornada],
    queryFn: () => api.obtener<readonly AdjuntoEnListado[]>(`/jornadas/${idJornada}/adjuntos`),
  });

  // La comprobación previa. Devuelve el motivo, o null si se puede intentar.
  const impedimento = ((): string | null => {
    if (archivo === null) return null;
    const extension = extensionDe(archivo.name);
    if (!extensionPermitida(extension)) {
      return `Los archivos .${extension || '(sin extensión)'} no se admiten. Se admiten: ${EXTENSIONES.join(', ')}.`;
    }
    if (archivo.size === 0) return 'El archivo está vacío.';
    if (cuota !== undefined && archivo.size > cuota.bytesDisponibles) {
      return (
        `Este archivo pesa ${formatearBytes(archivo.size)} y quedan ` +
        `${formatearBytes(cuota.bytesDisponibles)} entre todos los soportes de la jornada. ` +
        'Quite un soporte o reduzca el archivo.'
      );
    }
    return null;
  })();

  const subir = useMutation({
    mutationFn: async () => {
      if (archivo === null) throw new ErrorApi(0, { mensaje: 'Elija un archivo.' });
      if (fase === '') throw new ErrorApi(0, { mensaje: 'Elija la fase documental.' });
      const formulario = new FormData();
      formulario.append('faseDocumental', fase);
      formulario.append('archivo', archivo);
      return api.subir<{ nombreArchivo: string }>(`/jornadas/${idJornada}/adjuntos`, formulario);
    },
    onSuccess: (r) => {
      setError(null);
      setArchivo(null);
      setFase('');
      if (entrada.current !== null) entrada.current.value = '';
      void adjuntos.refetch();
      alCambiar();
      anunciar(`Soporte ${r.nombreArchivo} adjuntado.`);
    },
    onError: (e: unknown) =>
      setError(e instanceof ErrorApi ? e.message : 'No se pudo adjuntar el archivo.'),
  });

  const quitar = useMutation({
    mutationFn: (idAdjunto: number) =>
      api.eliminar<void>(`/jornadas/${idJornada}/adjuntos/${idAdjunto}`),
    onSuccess: () => {
      setAQuitar(null);
      void adjuntos.refetch();
      alCambiar();
      anunciar('Soporte quitado. Su espacio vuelve a la cuota.');
    },
    onError: (e: unknown) =>
      setError(e instanceof ErrorApi ? e.message : 'No se pudo quitar el soporte.'),
  });

  const descargar = useMutation({
    mutationFn: async (adjunto: AdjuntoEnListado) => {
      const contenido = await api.descargar(`/jornadas/${idJornada}/adjuntos/${adjunto.id}`);
      descargarArchivo(contenido, adjunto.nombreArchivo);
    },
    onError: (e: unknown) =>
      setError(e instanceof ErrorApi ? e.message : 'No se pudo descargar el soporte.'),
  });

  const lista = adjuntos.data ?? [];
  const sinSoportes = adjuntos.isSuccess && lista.length === 0;

  return (
    <>
      {cuota !== undefined && <MedidorCuota cuota={cuota} />}

      {/* El aviso del manual (lámina 22), con sus palabras. */}
      <div className="aviso aviso-info">
        <span className="aviso-icono"><Info tamano={17} /></span>
        <p>
          Existe restricción en el tamaño de los archivos: solo se permite un máximo de{' '}
          <strong>10 MB</strong>. Si sube varios, la suma del tamaño de todos no debe
          superar este valor.
        </p>
      </div>

      {sinSoportes && (
        <div className="aviso aviso-ojo">
          <span className="aviso-icono"><Alerta tamano={17} /></span>
          <p>
            Sin soportes todavía. Mientras falte, la jornada <strong>no</strong> entra en
            los consolidados del RAO.
          </p>
        </div>
      )}

      {/*
       * Los soportes, agrupados por tipo como en el manual: imágenes,
       * documentos, audios y videos, cada grupo con sus formatos permitidos.
       */}
      {adjuntos.isSuccess && (
        <div className="adjuntos-grupos">
          {CATEGORIAS.map(({ categoria, titulo }) => {
            const delGrupo = lista.filter((a) => a.categoria.toUpperCase() === categoria);
            const formatos = EXTENSIONES_POR_CATEGORIA[categoria].join(', ');
            return (
              <section key={categoria} className="adjuntos-grupo" aria-label={titulo}>
                <h3 className="adjuntos-grupo-titulo">
                  {titulo} <span className="adjuntos-formatos">({formatos})</span>
                </h3>
                {delGrupo.length === 0 ? (
                  <p className="adjuntos-vacio">No hay archivos cargados previamente.</p>
                ) : (
                  <div className="tabla-envoltura">
                    <table className="tabla tabla-compacta">
                      <thead>
                        <tr>
                          <th scope="col">Nombre</th>
                          <th scope="col">Fase</th>
                          <th scope="col">Fecha de cargue</th>
                          <th scope="col" className="num">Peso</th>
                          <th scope="col">
                            <span className="solo-lectores">Acciones</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {delGrupo.map((a) => (
                          <tr key={a.id}>
                            <td className="adjuntos-nombre">{a.nombreArchivo}</td>
                            <td>Fase {a.faseDocumental}</td>
                            <td className="datos">{formatearFechaDdMmAaaa(a.cargadoEn)}</td>
                            <td className="num datos">{formatearBytes(a.pesoBytes)}</td>
                            <td className="celda-acciones">
                              <span className="fila">
                                <button
                                  type="button"
                                  className="boton boton-fantasma boton-chico"
                                  onClick={() => descargar.mutate(a)}
                                  aria-label={`Descargar ${a.nombreArchivo}`}
                                >
                                  <Descargar tamano={15} /> Descargar
                                </button>
                                {puedeCargar &&
                                  (aQuitar === a.id ? (
                                    <>
                                      <button
                                        type="button"
                                        className="boton boton-peligro boton-chico"
                                        disabled={quitar.isPending}
                                        onClick={() => quitar.mutate(a.id)}
                                      >
                                        Eliminar
                                      </button>
                                      <button
                                        type="button"
                                        className="boton boton-fantasma boton-chico"
                                        onClick={() => setAQuitar(null)}
                                      >
                                        No
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="boton boton-fantasma boton-chico"
                                      onClick={() => setAQuitar(a.id)}
                                      aria-label={`Eliminar ${a.nombreArchivo}`}
                                    >
                                      <Cruz tamano={15} /> Eliminar
                                    </button>
                                  ))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {error !== null && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono"><Alerta tamano={17} /></span>
          <p>{error}</p>
        </div>
      )}

      {puedeCargar ? (
        <div className="adjuntar">
          <div className="campo">
            <label htmlFor="archivo">
              Soporte<span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <input
              id="archivo"
              ref={entrada}
              type="file"
              className="entrada"
              accept={EXTENSIONES.map((e) => `.${e}`).join(',')}
              aria-invalid={impedimento !== null}
              aria-describedby="archivo-ayuda"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
            {/*
             * El `accept` y la comprobación previa son comodidades, no la
             * validación. R12 exige validar el CONTENIDO real, y eso lo hace el
             * servidor leyendo los primeros bytes: renombrar un ejecutable a
             * .jpg no pasa.
             */}
            {impedimento !== null ? (
              <p className="error" id="archivo-ayuda">
                <Alerta tamano={15} /> {impedimento}
              </p>
            ) : (
              <p className="ayuda" id="archivo-ayuda">
                {archivo !== null
                  ? `${archivo.name} · ${formatearBytes(archivo.size)} · cabe en la cuota.`
                  : 'Imagen, documento, audio o video. El servidor verifica el contenido real del archivo, no su extensión.'}
              </p>
            )}
          </div>

          <div className="campo">
            <label htmlFor="fase">
              Fase documental<span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <select
              id="fase"
              className="entrada"
              value={fase}
              required
              onChange={(e) => setFase(e.target.value)}
            >
              <option value="">Seleccione…</option>
              {FASES_DOCUMENTALES.map((f) => (
                <option key={f} value={String(f)}>
                  Fase {f}
                </option>
              ))}
            </select>
            {/* Q7, respondida por el manual (lámina 22): qué va en cada fase. */}
            <p className="ayuda" aria-live="polite">
              {fase === ''
                ? 'Fase 1: diagnóstico · Fase 2: entidades · Fase 3: ejecución y evidencias.'
                : SOPORTES_POR_FASE_JORNADA[Number(fase) as 1 | 2 | 3]}
            </p>
          </div>

          <button
            type="button"
            className="boton boton-primario"
            disabled={subir.isPending || archivo === null || fase === '' || impedimento !== null}
            onClick={() => subir.mutate()}
          >
            <Adjuntar tamano={17} />
            {subir.isPending ? 'Adjuntando…' : 'Adjuntar'}
          </button>
        </div>
      ) : (
        <div className="aviso aviso-info">
          <span className="aviso-icono"><Info tamano={17} /></span>
          <p>No tiene permiso para adjuntar soportes.</p>
        </div>
      )}

      {lista.length > 0 && siguientePendiente !== null && (
        <div className="fila-sep seccion-pie">
          <p className="ayuda">Puede adjuntar más soportes o seguir con lo que falta.</p>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => irA(siguientePendiente)}
          >
            Seguir con la siguiente pendiente
          </button>
        </div>
      )}
    </>
  );
}
