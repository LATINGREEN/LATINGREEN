import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COAMI,
  ESQUEMA_POR_PESTANA,
  ETIQUETA_COAMI,
  ETIQUETA_PESTANA,
  FASES_DOCUMENTALES,
  PESTANAS_ACTIVIDAD,
  crearJornada,
} from '@paid/schema';
import type {
  Coami,
  CoordenadaGms,
  EstadoCuota,
  PestanaActividad,
  PestanaConDatos,
} from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useAnuncio } from '../api/accesibilidad';
import { useSesion } from '../api/sesion';
import { CoordenadasGms } from '../componentes/CoordenadasGms';
import { MedidorCuota } from '../componentes/MedidorCuota';
import { RosaPestanas } from '../componentes/RosaPestanas';
import { CampoSelector } from '../componentes/CampoSelector';
import { CampoEntidad } from '../componentes/CampoEntidad';
import {
  CAMPOS_DE_ENTIDAD,
  CATALOGO_DE_CAMPO,
  aValorDeEnvio,
  clasificarCampo,
  humanizarCampo,
} from './campos-pestana';
import type { EsquemaDeCampo } from './campos-pestana';
import { Adjuntar, Alerta, Info, Marca, Mas } from '../componentes/Iconos';

/**
 * Formulario de una jornada, con sus once pestañas (R19).
 *
 * ── Por qué en dos etapas ───────────────────────────────────────────────
 *
 * Primero los datos generales; al guardarlos, se habilitan las pestañas. No es
 * una concesión técnica —aunque sí es cierto que las tablas hijas necesitan el
 * identificador de la actividad—: es que el clavegrama es lo primero que el
 * usuario tiene, y las once pestañas son la transcripción de lo que ya escribió
 * ahí. Pedirle todo de golpe en un formulario de sesenta campos es exactamente
 * el trabajo que B.1 describe como insoportable.
 *
 * (Y es la puerta por donde entra U1 en la Fase 7: el botón «Extraer del
 * clavegrama» irá justo al lado de la descripción, y rellenará las pestañas
 * como propuestas.)
 *
 * ── La Rosa como navegador ──────────────────────────────────────────────
 *
 * Las once pestañas no se navegan con una fila de etiquetas que se sale de la
 * pantalla, sino con la Rosa: once segmentos, se ve de un golpe cuáles tienen
 * datos y se salta a cualquiera. El estado y la navegación son la misma cosa.
 */

const GMS_INICIAL: CoordenadaGms = {
  latitudGrados: 10,
  latitudMinutos: 0,
  latitudSegundos: 0,
  latitudHemisferio: 'N',
  longitudGrados: 75,
  longitudMinutos: 0,
  longitudSegundos: 0,
  longitudHemisferio: 'W',
};

interface EstadoPestanas {
  readonly registroCompleto: boolean;
  readonly faltantes: readonly PestanaActividad[];
  readonly completas: readonly PestanaActividad[];
}

export function JornadaFormulario(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const esNueva = id === undefined || id === 'nueva';
  const navegar = useNavigate();
  const anunciar = useAnuncio();
  const { puede } = useSesion();
  const clienteConsultas = useQueryClient();

  const [gms, setGms] = useState<CoordenadaGms>(GMS_INICIAL);
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaEjecucion, setFechaEjecucion] = useState('');
  const [lugar, setLugar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [coamiElegidos, setCoamiElegidos] = useState<readonly Coami[]>([]);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pestanaActiva, setPestanaActiva] = useState<PestanaActividad>('TIPO_OPERACION');

  const idJornada = esNueva ? null : Number(id);

  const estado = useQuery({
    queryKey: ['jornada-pestanas', idJornada],
    queryFn: () => api.obtener<EstadoPestanas>(`/jornadas/${idJornada}/pestanas`),
    enabled: idJornada !== null,
  });

  const cuota = useQuery({
    queryKey: ['jornada-cuota', idJornada],
    queryFn: () =>
      api.obtener<EstadoCuota & { cuotaTotalBytes: number }>(
        `/jornadas/${idJornada}/adjuntos/cuota`,
      ),
    enabled: idJornada !== null,
  });

  const guardar = useMutation({
    mutationFn: async () => {
      // Se valida con el MISMO esquema Zod que usa el controlador (A.6). Si
      // divergieran, el usuario vería un error distinto del que el servidor
      // aplica, que es el peor de los mundos.
      const datos = crearJornada.safeParse({
        ...gms,
        descripcion,
        fechaInicio,
        fechaEjecucion,
        lugar,
        ...(observaciones !== '' ? { observaciones } : {}),
        participoArc: true,
        coami: coamiElegidos,
      });
      if (!datos.success) {
        const porCampo: Record<string, string> = {};
        for (const problema of datos.error.issues) {
          porCampo[problema.path.join('.')] = problema.message;
        }
        setErroresCampo(porCampo);
        throw new Error('validacion');
      }
      setErroresCampo({});
      return api.crear<{ id: number; codigoActividad: string }>('/jornadas', datos.data);
    },
    onSuccess: (creada) => {
      // El listado tiene una jornada más, y con sus once pestañas en blanco.
      void clienteConsultas.invalidateQueries({ queryKey: ['jornadas'] });
      anunciar(`Jornada ${creada.codigoActividad} registrada. Ahora diligencie las once pestañas.`);
      navegar(`/jornadas/${creada.id}`);
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === 'validacion') {
        setErrorGeneral('Revise los campos marcados.');
        return;
      }
      if (error instanceof ErrorApi) {
        const porCampo: Record<string, string> = {};
        for (const d of error.porCampo) porCampo[d.campo] = d.mensaje;
        setErroresCampo(porCampo);
        setErrorGeneral(error.message);
      } else {
        setErrorGeneral('No se pudo registrar la jornada.');
      }
    },
  });

  /**
   * Qué caché hay que tirar cuando cambia algo de esta jornada.
   *
   * ⚠️ `['jornadas']` está en la lista, y no es de más. Al diligenciar la
   * undécima pestaña la jornada pasa a `registro_completo = SÍ`, y **el
   * listado es la pantalla que decide qué entra en el consolidado del RAO**.
   * Sin esta invalidación el listado seguía mostrando la copia de la caché con
   * «Faltan 11» durante 30 segundos: una jornada completa que se anunciaba
   * como incompleta, sin error y sin que nada lo delatara. Lo encontró la
   * prueba de la Puerta 4.
   *
   * Es exactamente el defecto que PROMPT.md describe al final: no falla,
   * parece funcionar, y el dato que muestra no es el que hay.
   */
  const refrescarJornada = useCallback(() => {
    void clienteConsultas.invalidateQueries({ queryKey: ['jornada-pestanas', idJornada] });
    void clienteConsultas.invalidateQueries({ queryKey: ['jornada-cuota', idJornada] });
    void clienteConsultas.invalidateQueries({ queryKey: ['jornadas'] });
  }, [clienteConsultas, idJornada]);

  const completas = estado.data?.completas ?? [];

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Cooperación Civil Militar · Jornadas de Apoyo</span>
          <h1>{esNueva ? 'Registrar jornada' : `Jornada ${id}`}</h1>
          <p className="pagina-descripcion">
            {esNueva
              ? 'Pegue el clavegrama en la descripción y complete los datos generales. Al guardar se habilitan las once pestañas.'
              : 'Las once pestañas deben quedar diligenciadas para que la jornada entre en los consolidados del RAO.'}
          </p>
        </div>
        {/*
          * Aquí NO va otra Rosa grande. Estaba, y se veía mal de dos maneras:
          * duplicaba la del navegador de pestañas —el mismo dato dos veces en
          * la misma pantalla, que invita a mirar la que esté más cerca y a
          * dudar de si dicen lo mismo— y al desplazar la página quedaba
          * cortada por la barra superior fija. El estado vive en un solo
          * sitio: el navegador de pestañas.
          */}
      </div>

      {errorGeneral !== null && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono"><Alerta tamano={18} /></span>
          <p>{errorGeneral}</p>
        </div>
      )}

      {/* ── Etapa 1: datos generales ─────────────────────────────────── */}
      {esNueva && (
        <div className="tarjeta seccion escalonado">
          <div className="campo">
            <label htmlFor="descripcion">
              Descripción de la jornada (clavegrama)
              <span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <textarea
              id="descripcion"
              className="entrada"
              rows={7}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              aria-invalid={erroresCampo['descripcion'] !== undefined}
              placeholder="Pegue aquí el clavegrama completo, sin omitir detalle."
              required
            />
            {erroresCampo['descripcion'] !== undefined && (
              <p className="error">
                <Alerta tamano={15} /> {erroresCampo['descripcion']}
              </p>
            )}
            <p className="ayuda">
              De este texto salen las once pestañas. Cópielo completo: es la fuente de
              todo lo que se registra después.
            </p>
          </div>

          <div className="rejilla-2">
            <CampoFecha
              id="fechaInicio"
              rotulo="Fecha de inicio"
              valor={fechaInicio}
              onCambio={setFechaInicio}
              error={erroresCampo['fechaInicio']}
            />
            <CampoFecha
              id="fechaEjecucion"
              rotulo="Fecha de ejecución"
              valor={fechaEjecucion}
              onCambio={setFechaEjecucion}
              error={erroresCampo['fechaEjecucion']}
            />
          </div>

          <div className="campo">
            <label htmlFor="lugar">
              Lugar<span className="obligatorio" aria-hidden="true">*</span>
            </label>
            <input
              id="lugar"
              className="entrada"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              aria-invalid={erroresCampo['lugar'] !== undefined}
              placeholder="Corregimiento, vereda o sitio exacto"
              required
            />
            {erroresCampo['lugar'] !== undefined && (
              <p className="error"><Alerta tamano={15} /> {erroresCampo['lugar']}</p>
            )}
          </div>

          <CoordenadasGms
            valor={gms}
            onCambio={setGms}
            errores={erroresCampo}
            {...(lugar !== '' ? { lugar } : {})}
          />

          {/* R9 — La ARC siempre participa: marcado y DESHABILITADO. */}
          <div className="campo">
            <label htmlFor="observaciones">Observaciones</label>
            <textarea
              id="observaciones"
              className="entrada"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              aria-describedby="observaciones-ayuda"
            />
            <p className="ayuda" id="observaciones-ayuda">
              Opcional. Lo que no cabe en el clavegrama: novedades, motivos de un
              cambio de fecha, lo que haya que recordar al revisar el registro.
            </p>
          </div>

          <div className="tarjeta arc">
            <label className="fila">
              <input type="checkbox" checked disabled aria-describedby="ayuda-arc" />
              <span>
                <strong>Participación de la ARC</strong>
              </span>
            </label>
            <p className="ayuda" id="ayuda-arc">
              Siempre sí. El manual lo exige y la base de datos lo impone: no es un
              campo que se pueda cambiar.
            </p>
          </div>

          {/* R18 — COAMI: cero a muchos, NINGUNO por defecto. */}
          <fieldset className="tarjeta coami">
            <legend className="rotulo">COAMI participantes</legend>
            <p className="ayuda">
              Si no hubo participación de la Reserva Naval,{' '}
              <strong>no seleccione ninguno</strong>. Dejarlo vacío es un valor válido.
            </p>
            <div className="coami-lista">
              {COAMI.map((codigo) => {
                const elegido = coamiElegidos.includes(codigo);
                return (
                  <label key={codigo} className={`coami-opcion ${elegido ? 'es-activa' : ''}`}>
                    <input
                      type="checkbox"
                      checked={elegido}
                      onChange={(e) =>
                        setCoamiElegidos((antes) =>
                          e.target.checked
                            ? [...antes, codigo]
                            : antes.filter((c) => c !== codigo),
                        )
                      }
                    />
                    <span>{ETIQUETA_COAMI[codigo]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="fila-sep seccion-pie">
            <p className="ayuda">
              Al guardar se genera el código de actividad y se habilitan las once pestañas.
            </p>
            <button
              type="button"
              className="boton boton-primario"
              disabled={guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Etapa 2: las once pestañas ───────────────────────────────── */}
      {!esNueva && idJornada !== null && (
        <div className="pestanas">
          <nav className="pestanas-rosa" aria-label="Pestañas de la jornada">
            <RosaPestanas
              completas={completas}
              tamano="grande"
              pestanaActiva={pestanaActiva}
              onElegir={setPestanaActiva}
            />
            <ul className="pestanas-lista">
              {PESTANAS_ACTIVIDAD.map((pestana) => {
                const lista = completas.includes(pestana);
                return (
                  <li key={pestana}>
                    <button
                      type="button"
                      className={`pestanas-enlace ${pestanaActiva === pestana ? 'es-activa' : ''}`}
                      /* La prueba de la Puerta 4 navega por este atributo y no
                         por el rótulo: los rótulos llevan tildes y son texto
                         para personas, que puede cambiar sin que el sentido de
                         la pestaña cambie. */
                      data-pestana={pestana}
                      onClick={() => setPestanaActiva(pestana)}
                      aria-current={pestanaActiva === pestana}
                    >
                      <span className={`pestanas-marca ${lista ? 'es-lista' : ''}`} aria-hidden="true">
                        {lista ? <Marca tamano={13} /> : null}
                      </span>
                      <span>{ETIQUETA_PESTANA[pestana]}</span>
                      <span className="solo-lectores">
                        {lista ? '. Con datos.' : '. Sin datos.'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section className="pestanas-panel tarjeta" aria-live="polite">
            <h2>{ETIQUETA_PESTANA[pestanaActiva]}</h2>

            {pestanaActiva === 'ARCHIVOS_ADJUNTOS' ? (
              <PanelAdjuntos
                idJornada={idJornada}
                cuota={cuota.data}
                puedeCargar={puede('ADJUNTO.CARGAR')}
                alCambiar={refrescarJornada}
              />
            ) : (
              <PanelPestanaDatos
                idJornada={idJornada}
                pestana={pestanaActiva as PestanaConDatos}
                yaTieneDatos={completas.includes(pestanaActiva)}
                alCambiar={refrescarJornada}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}

/** Fecha en `dd/mm/aaaa` (A.2.4). Texto y no `<input type="date">`. */
function CampoFecha({
  id,
  rotulo,
  valor,
  onCambio,
  error,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly onCambio: (v: string) => void;
  /* `| undefined` explícito: el proyecto compila con
     `exactOptionalPropertyTypes` y el error llega de un mapa donde la
     ausencia ES `undefined`. */
  readonly error?: string | undefined;
}): JSX.Element {
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}<span className="obligatorio" aria-hidden="true">*</span>
      </label>
      <input
        id={id}
        className="entrada datos"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        aria-invalid={error !== undefined}
        aria-describedby={`${id}-ayuda`}
        required
      />
      {error !== undefined && (
        <p className="error"><Alerta tamano={15} /> {error}</p>
      )}
      {/*
       * Texto y no `<input type="date">` a propósito: el selector nativo
       * presenta el formato según la configuración regional del equipo, y el
       * manual exige dd/mm/aaaa. Un usuario en un equipo mal configurado vería
       * mm/dd/aaaa y registraría el 3 de mayo como el 5 de marzo, sin que nada
       * fallara.
       */}
      <p className="ayuda" id={`${id}-ayuda`}>
        Formato dd/mm/aaaa. Por ejemplo, 05/03/2026.
      </p>
    </div>
  );
}

/**
 * Panel genérico de una pestaña de datos.
 *
 * Se construye del esquema Zod compartido, igual que el servidor construye el
 * SQL de `MAPA_PESTANAS`. ⚠️ TODO(JACID) Q4: los campos reales de cinco de
 * estas pestañas no se conocen, así que este panel presenta los mínimos que las
 * reglas permiten afirmar. Cuando Q4 se responda, el esquema cambia y este
 * panel lo sigue sin tocarse.
 */
function PanelPestanaDatos({
  idJornada,
  pestana,
  yaTieneDatos,
  alCambiar,
}: {
  readonly idJornada: number;
  readonly pestana: PestanaConDatos;
  readonly yaTieneDatos: boolean;
  readonly alCambiar: () => void;
}): JSX.Element {
  const anunciar = useAnuncio();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // La forma del esquema Zod de la pestaña: de ahí salen los campos Y su tipo.
  const forma = useMemo<Record<string, EsquemaDeCampo>>(() => {
    const esquema = ESQUEMA_POR_PESTANA[pestana];
    return (
      (esquema as unknown as { shape?: Record<string, EsquemaDeCampo> }).shape ?? {}
    );
  }, [pestana]);
  const campos = useMemo(() => Object.keys(forma), [forma]);

  const agregar = useMutation({
    mutationFn: () => {
      const cuerpo: Record<string, unknown> = {};
      for (const [campo, crudo] of Object.entries(valores)) {
        if (crudo === '') continue;
        // Los campos que empiezan por «id» o «cantidad» son numéricos.
        // La forma —cadena o número— la decide el esquema del campo, no una
        // regla escrita aquí. Ver `aValorDeEnvio`.
        cuerpo[campo] = aValorDeEnvio(forma[campo], crudo);
      }
      return api.crear<{ id: number }>(`/jornadas/${idJornada}/pestanas/${pestana}`, cuerpo);
    },
    onSuccess: () => {
      setValores({});
      setError(null);
      anunciar(`${ETIQUETA_PESTANA[pestana]}: registro añadido.`);
      alCambiar();
    },
    onError: (e: unknown) =>
      setError(e instanceof ErrorApi ? e.message : 'No se pudo añadir el registro.'),
  });

  return (
    <>
      {yaTieneDatos ? (
        <div className="aviso aviso-bien">
          <span className="aviso-icono"><Marca tamano={17} /></span>
          <p>Esta pestaña ya tiene datos. Puede añadir más registros.</p>
        </div>
      ) : (
        <div className="aviso aviso-ojo">
          <span className="aviso-icono"><Info tamano={17} /></span>
          <p>
            Sin datos todavía. Mientras falte, la jornada <strong>no</strong> entra en los
            consolidados del RAO.
          </p>
        </div>
      )}

      {error !== null && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono"><Alerta tamano={17} /></span>
          <p>{error}</p>
        </div>
      )}

      <div className="rejilla-2 panel-campos">
        {campos.map((campo) => {
          const fijar = (valor: string): void =>
            setValores((v) => ({ ...v, [campo]: valor }));
          const catalogo = CATALOGO_DE_CAMPO[campo];

          /*
           * Un campo que apunta a un catálogo cerrado de `ref` se dibuja como
           * desplegable, y uno que apunta al maestro de Entidades A.I. como
           * selector de entidad. Nunca como número: el identificador no
           * aparece en ninguna pantalla, así que un campo numérico ahí no se
           * puede diligenciar, y un número inventado llega al servidor como
           * violación de clave foránea. Lo cazó la prueba de la Puerta 4.
           */
          if (catalogo !== undefined) {
            return (
              <CampoSelector
                key={campo}
                id={`p-${campo}`}
                rotulo={humanizarCampo(campo)}
                catalogo={catalogo}
                valor={valores[campo] ?? ''}
                obligatorio
                onCambio={fijar}
              />
            );
          }
          if (CAMPOS_DE_ENTIDAD.includes(campo)) {
            return (
              <CampoEntidad
                key={campo}
                id={`p-${campo}`}
                rotulo={humanizarCampo(campo)}
                valor={valores[campo] ?? ''}
                obligatorio={campo === 'idEntidad'}
                onCambio={fijar}
              />
            );
          }

          const clase = clasificarCampo(forma[campo]);
          const numerico = clase !== 'texto';
          return (
            <div className="campo" key={campo}>
              <label htmlFor={`p-${campo}`}>{humanizarCampo(campo)}</label>
              <input
                id={`p-${campo}`}
                className={`entrada ${numerico ? 'datos' : ''}`}
                value={valores[campo] ?? ''}
                onChange={(e) => fijar(e.target.value)}
                inputMode={clase === 'decimal' ? 'decimal' : clase === 'entero' ? 'numeric' : 'text'}
                {...(numerico ? { 'aria-describedby': `p-${campo}-ayuda` } : {})}
              />
              {/* La ayuda dice la verdad de ESE campo. Anunciar «el separador
                  decimal es el punto» en un campo entero —que rechaza los
                  decimales— es peor que no decir nada: invita a escribir algo
                  que se va a rechazar. */}
              {clase === 'decimal' && (
                <p className="ayuda" id={`p-${campo}-ayuda`}>
                  Admite decimales. El separador es el punto. Ejemplo: 45.5
                </p>
              )}
              {clase === 'entero' && (
                <p className="ayuda" id={`p-${campo}-ayuda`}>
                  Número entero, sin decimales ni puntos de miles.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="fila-sep seccion-pie">
        <p className="ayuda">
          TODO(JACID) Q4: los campos definitivos de esta pestaña están por confirmar.
        </p>
        <button
          type="button"
          className="boton boton-primario"
          disabled={agregar.isPending}
          onClick={() => agregar.mutate()}
        >
          <Mas tamano={17} />
          {agregar.isPending ? 'Añadiendo…' : 'Añadir registro'}
        </button>
      </div>
    </>
  );
}

/** Pestaña de adjuntos: R11 y R12 en pantalla. */
function PanelAdjuntos({
  idJornada,
  cuota,
  puedeCargar,
  alCambiar,
}: {
  readonly idJornada: number;
  readonly cuota: (EstadoCuota & { cuotaTotalBytes: number }) | undefined;
  readonly puedeCargar: boolean;
  readonly alCambiar: () => void;
}): JSX.Element {
  const anunciar = useAnuncio();
  const entrada = useRef<HTMLInputElement | null>(null);
  const [fase, setFase] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const subir = useMutation({
    mutationFn: async () => {
      const archivo = entrada.current?.files?.[0];
      if (archivo === undefined) throw new Error('Elija un archivo.');
      const formulario = new FormData();
      formulario.append('faseDocumental', String(fase));
      formulario.append('archivo', archivo);
      return api.subir<{ nombreArchivo: string }>(
        `/jornadas/${idJornada}/adjuntos`,
        formulario,
      );
    },
    onSuccess: (r) => {
      setError(null);
      if (entrada.current !== null) entrada.current.value = '';
      anunciar(`Soporte ${r.nombreArchivo} adjuntado.`);
      alCambiar();
    },
    onError: (e: unknown) =>
      setError(e instanceof ErrorApi ? e.message : 'No se pudo adjuntar el archivo.'),
  });

  return (
    <>
      {cuota !== undefined && <MedidorCuota cuota={cuota} />}

      {error !== null && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono"><Alerta tamano={17} /></span>
          <p>{error}</p>
        </div>
      )}

      {puedeCargar ? (
        <div className="adjuntar">
          <div className="campo">
            <label htmlFor="archivo">Soporte</label>
            <input
              id="archivo"
              ref={entrada}
              type="file"
              className="entrada"
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.wma,.mp4,.wmv,.avi"
            />
            {/*
             * El `accept` es una comodidad, no la validación. R12 exige validar
             * contra el CONTENIDO real: el servidor lee los primeros bytes y
             * compara el MIME. Renombrar un ejecutable a .jpg no pasa, y decirlo
             * aquí evita que alguien lo intente creyendo que es un descuido.
             */}
            <p className="ayuda">
              Imagen, documento, audio o video. El servidor verifica el contenido real
              del archivo, no su extensión.
            </p>
          </div>

          <div className="campo">
            <label htmlFor="fase">Fase documental</label>
            <select
              id="fase"
              className="entrada"
              value={fase}
              onChange={(e) => setFase(Number(e.target.value))}
            >
              {FASES_DOCUMENTALES.map((f) => (
                <option key={f} value={f}>
                  Fase {f}
                </option>
              ))}
            </select>
            <p className="ayuda">TODO(JACID) Q7: significado de cada fase por confirmar.</p>
          </div>

          <button
            type="button"
            className="boton boton-primario"
            disabled={subir.isPending}
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
    </>
  );
}

/** `idServicioPrestado` → «Id servicio prestado». */
