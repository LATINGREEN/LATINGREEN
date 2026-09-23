import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  COAMI,
  ETIQUETA_COAMI,
  actualizarJornada,
  crearJornada,
  formatearFechaDdMmAaaa,
} from '@paid/schema';
import type { Coami, JornadaDetalle } from '@paid/schema';
import { ErrorApi, api } from '../../api/cliente';
import { useAnuncio } from '../../api/accesibilidad';
import { useAvisoSalida } from '../../api/avisoSalida';
import { Campo } from '../../componentes/Campo';
import { CampoFecha } from '../../componentes/CampoFecha';
import { CampoSelector } from '../../componentes/CampoSelector';
import { CampoSiNo, aSiNo, deSiNo } from '../../componentes/CampoSiNo';
import type { SiNo } from '../../componentes/CampoSiNo';
import {
  CoordenadasGms,
  GMS_VACIO,
  aBorradorGms,
  completarGms,
} from '../../componentes/CoordenadasGms';
import type { BorradorGms } from '../../componentes/CoordenadasGms';
import { ResumenErrores } from '../../componentes/ResumenErrores';
import { Marca } from '../../componentes/Iconos';

/**
 * Los datos generales de una jornada: el mismo formulario para REGISTRARLA y
 * para CORREGIRLA.
 *
 * Antes solo existía el de registro: una vez guardada, la jornada no mostraba
 * su clavegrama ni sus fechas, y un error de digitación en la fecha de
 * ejecución no tenía dónde corregirse desde la pantalla, aunque el servidor lo
 * admitía desde la Fase 3.
 *
 * Añadidos respecto a la versión anterior, los tres venían del esquema y la
 * pantalla no los pedía:
 *
 * - **Departamento y municipio.** El listado del manual tiene la columna
 *   «Municipio», y salía siempre «—» porque nada la llenaba.
 * - **Fecha de finalización**, opcional. La base exige que no sea anterior al
 *   inicio; aquí se avisa antes de enviar.
 * - El resumen de errores con enlaces a cada campo.
 *
 * Y el orden de los campos es el del manual (láminas 20 y 21): clavegrama,
 * tipo de jornada, participación de EJC · ARC · FAC, COAMI, ubicación, fechas
 * con «población afecta», y observaciones. Quien aprendió con el manual
 * encuentra cada cosa donde la busca.
 */

const ROTULOS: Readonly<Record<string, string>> = {
  descripcion: 'Descripción (clavegrama)',
  idTipoJornada: 'Tipo de jornada',
  participoEjc: 'Participó el EJC',
  participoFac: 'Participó la FAC',
  poblacionAfectaTropa: 'Población afecta a la tropa',
  fechaInicio: 'Fecha de inicio',
  fechaFin: 'Fecha de finalización',
  fechaEjecucion: 'Fecha de ejecución',
  lugar: 'Lugar',
  observaciones: 'Observaciones',
  idMunicipio: 'Municipio',
  latitudGrados: 'Latitud: grados',
  latitudMinutos: 'Latitud: minutos',
  latitudSegundos: 'Latitud: segundos',
  latitudHemisferio: 'Latitud: hemisferio',
  longitudHemisferio: 'Longitud: hemisferio',
  longitudGrados: 'Longitud: grados',
  longitudMinutos: 'Longitud: minutos',
  longitudSegundos: 'Longitud: segundos',
  coami: 'COAMI participantes',
};

interface Borrador {
  readonly descripcion: string;
  readonly idTipoJornada: string;
  readonly participoEjc: SiNo;
  readonly participoFac: SiNo;
  readonly poblacionAfectaTropa: SiNo;
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly fechaEjecucion: string;
  readonly lugar: string;
  readonly observaciones: string;
  readonly idDepartamento: string;
  readonly idMunicipio: string;
  readonly gms: BorradorGms;
  readonly coami: readonly Coami[];
}

const VACIO: Borrador = {
  descripcion: '',
  idTipoJornada: '',
  participoEjc: '',
  participoFac: '',
  poblacionAfectaTropa: '',
  fechaInicio: '',
  fechaFin: '',
  fechaEjecucion: '',
  lugar: '',
  observaciones: '',
  idDepartamento: '',
  idMunicipio: '',
  gms: GMS_VACIO,
  coami: [],
};

function desdeDetalle(d: JornadaDetalle): Borrador {
  return {
    descripcion: d.descripcion,
    // En una jornada anterior a la migración 0015 llegan en NULL y el
    // formulario los muestra sin responder: se piden, no se suponen.
    idTipoJornada: d.idTipoJornada === null ? '' : String(d.idTipoJornada),
    participoEjc: aSiNo(d.participoEjc),
    participoFac: aSiNo(d.participoFac),
    poblacionAfectaTropa: aSiNo(d.poblacionAfectaTropa),
    fechaInicio: formatearFechaDdMmAaaa(d.fechaInicio),
    fechaFin: d.fechaFin === null ? '' : formatearFechaDdMmAaaa(d.fechaFin),
    fechaEjecucion: formatearFechaDdMmAaaa(d.fechaEjecucion),
    lugar: d.lugar,
    observaciones: d.observaciones ?? '',
    idDepartamento: d.idDepartamento === null ? '' : String(d.idDepartamento),
    idMunicipio: d.idMunicipio === null ? '' : String(d.idMunicipio),
    gms: aBorradorGms(d),
    coami: d.coami.filter((c): c is Coami => (COAMI as readonly string[]).includes(c)),
  };
}

export function DatosGenerales({
  inicial,
  alGuardar,
  alCancelar,
}: {
  /** Presente al corregir una jornada ya registrada. */
  readonly inicial?: JornadaDetalle | undefined;
  readonly alGuardar: (resultado: { id: number; codigoActividad?: string }) => void;
  readonly alCancelar?: (() => void) | undefined;
}): JSX.Element {
  const anunciar = useAnuncio();
  const clienteConsultas = useQueryClient();
  const original = useMemo(() => (inicial === undefined ? VACIO : desdeDetalle(inicial)), [inicial]);
  const [b, setB] = useState<Borrador>(original);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const hayCambios = !guardado && JSON.stringify(b) !== JSON.stringify(original);
  useAvisoSalida(hayCambios);

  const fijar = <K extends keyof Borrador>(clave: K, valor: Borrador[K]): void =>
    setB((antes) => ({ ...antes, [clave]: valor }));

  const guardar = useMutation({
    mutationFn: async () => {
      const porCampo: Record<string, string> = {};

      const gms = completarGms(b.gms);
      if ('faltan' in gms) Object.assign(porCampo, gms.faltan);

      const cuerpo: Record<string, unknown> = {
        ...('coordenada' in gms ? gms.coordenada : {}),
        descripcion: b.descripcion,
        fechaInicio: b.fechaInicio,
        fechaEjecucion: b.fechaEjecucion,
        lugar: b.lugar,
        coami: b.coami,
      };
      if (b.fechaFin.trim() !== '') cuerpo['fechaFin'] = b.fechaFin;
      // Al corregir, un campo vaciado se envía vacío: ausente significaría
      // «no lo toques» y la observación borrada volvería a aparecer.
      if (b.observaciones.trim() !== '' || inicial !== undefined) {
        cuerpo['observaciones'] = b.observaciones;
      }
      if (b.idMunicipio !== '') cuerpo['idMunicipio'] = Number(b.idMunicipio);

      // Láminas 20–21. Al corregir también se piden: es la forma de completar
      // las jornadas registradas antes de que existieran estos campos.
      cuerpo['idTipoJornada'] = b.idTipoJornada;
      const siNo = {
        participoEjc: b.participoEjc,
        participoFac: b.participoFac,
        poblacionAfectaTropa: b.poblacionAfectaTropa,
      } as const;
      for (const [clave, valor] of Object.entries(siNo)) {
        const booleano = deSiNo(valor);
        if (booleano !== undefined) cuerpo[clave] = booleano;
      }

      const esquema = inicial === undefined ? crearJornada : actualizarJornada;
      const validado = esquema.safeParse(
        inicial === undefined ? { ...cuerpo, participoArc: true } : cuerpo,
      );
      if (!validado.success) {
        for (const problema of validado.error.issues) {
          const clave = String(problema.path[0] ?? '');
          /*
           * Con la coordenada incompleta no se envía NINGUNA de sus ocho
           * partes, y el esquema reclama también las que sí están llenas —el
           * hemisferio W, que viene elegido— con su mensaje en inglés y el
           * nombre interno del campo. Lo que falta ya lo dice `completarGms`
           * parte por parte; el resto sobra.
           */
          if ('faltan' in gms && clave.startsWith('latitud')) continue;
          if ('faltan' in gms && clave.startsWith('longitud')) continue;
          if (porCampo[clave] === undefined) porCampo[clave] = problema.message;
        }
      }

      if (inicial !== undefined) {
        if (b.idTipoJornada === '') porCampo['idTipoJornada'] = 'Elija el tipo de jornada.';
        if (b.participoEjc === '') porCampo['participoEjc'] = 'Indique si participó el Ejército (EJC).';
        if (b.participoFac === '') porCampo['participoFac'] = 'Indique si participó la Fuerza Aérea (FAC).';
        if (b.poblacionAfectaTropa === '') {
          porCampo['poblacionAfectaTropa'] = 'Indique si la población es afecta a la tropa.';
        }
      }

      // La base lo exige (actividad_fechas_coherentes); aquí se dice antes y
      // con palabras, en lugar de dejar que llegue como una violación de
      // restricción.
      if (validado.success && 'fechaFin' in validado.data && validado.data.fechaFin !== undefined) {
        const inicio = validado.data.fechaInicio;
        if (inicio !== undefined && validado.data.fechaFin < inicio) {
          porCampo['fechaFin'] = 'La finalización no puede ser anterior al inicio.';
        }
      }

      if (Object.keys(porCampo).length > 0 || !validado.success) {
        setErrores(porCampo);
        setMensaje(null);
        throw new Error('validacion');
      }
      setErrores({});
      setMensaje(null);

      if (inicial === undefined) {
        return api.crear<{ id: number; codigoActividad: string }>('/jornadas', validado.data);
      }
      await api.modificar<void>(`/jornadas/${inicial.id}`, validado.data);
      return { id: inicial.id };
    },
    onSuccess: (resultado) => {
      setGuardado(true);
      void clienteConsultas.invalidateQueries({ queryKey: ['jornadas'] });
      void clienteConsultas.invalidateQueries({ queryKey: ['jornada', resultado.id] });
      anunciar(
        inicial === undefined
          ? 'Jornada registrada. Ahora diligencie las once pestañas.'
          : 'Datos generales corregidos.',
      );
      alGuardar(resultado);
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === 'validacion') return;
      if (error instanceof ErrorApi) {
        const porCampo: Record<string, string> = {};
        for (const d of error.porCampo) porCampo[d.campo] = d.mensaje;
        setErrores(porCampo);
        setMensaje(error.message);
      } else {
        setMensaje('No se pudo guardar la jornada.');
      }
    },
  });

  return (
    <div className="tarjeta seccion escalonado">
      <ResumenErrores errores={errores} rotulos={ROTULOS} mensaje={mensaje} />

      <Campo
        id="descripcion"
        rotulo="Descripción de la jornada (clavegrama)"
        valor={b.descripcion}
        onCambio={(v) => fijar('descripcion', v)}
        obligatorio
        multilinea
        error={errores['descripcion']}
        ayuda="De este texto salen las once pestañas. Péguelo completo: es la fuente de todo lo que se registra después."
      />

      {/* ── Lámina 20 ─────────────────────────────────────────────────── */}
      <div className="rejilla-3 rejilla-llena">
        <CampoSelector
          id="idTipoJornada"
          rotulo="Tipo de jornada"
          catalogo="tipo_jornada"
          valor={b.idTipoJornada}
          onCambio={(v) => fijar('idTipoJornada', v)}
          obligatorio
          error={errores['idTipoJornada']}
        />
      </div>

      <fieldset className="participacion">
        <legend className="rotulo">Participación de las Fuerzas</legend>
        <div className="rejilla-3">
          <CampoSiNo
            id="participoEjc"
            rotulo="Ejército (EJC)"
            valor={b.participoEjc}
            onCambio={(v) => fijar('participoEjc', v)}
            error={errores['participoEjc']}
          />
          {/* R9 — La ARC siempre participa: fijado en «Sí» y DESHABILITADO. */}
          <CampoSiNo
            id="participoArc"
            rotulo="Armada (ARC)"
            valor="SI"
            fijo
            ayuda="Siempre sí: el manual lo exige y la base de datos lo impone."
          />
          <CampoSiNo
            id="participoFac"
            rotulo="Fuerza Aérea (FAC)"
            valor={b.participoFac}
            onCambio={(v) => fijar('participoFac', v)}
            error={errores['participoFac']}
          />
        </div>
      </fieldset>

      {/* R18 — COAMI: cero a muchos, NINGUNO por defecto. */}
      <fieldset className="tarjeta coami">
        <legend className="rotulo">COAMI participantes</legend>
        <p className="ayuda">
          Si no hubo participación de la Reserva Naval, <strong>no seleccione ninguno</strong>
          . Dejarlo vacío es un valor válido.
        </p>
        <div className="coami-lista">
          {COAMI.map((codigo) => {
            const elegido = b.coami.includes(codigo);
            return (
              <label key={codigo} className={`coami-opcion ${elegido ? 'es-activa' : ''}`}>
                <input
                  type="checkbox"
                  checked={elegido}
                  onChange={(e) =>
                    fijar(
                      'coami',
                      e.target.checked
                        ? [...b.coami, codigo]
                        : b.coami.filter((c) => c !== codigo),
                    )
                  }
                />
                <span>{ETIQUETA_COAMI[codigo]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* ── Lámina 21 ─────────────────────────────────────────────────── */}
      <div className="rejilla-3">
        <Campo
          id="lugar"
          rotulo="Lugar"
          valor={b.lugar}
          onCambio={(v) => fijar('lugar', v)}
          obligatorio
          ayuda="Corregimiento, vereda o sitio exacto."
          error={errores['lugar']}
        />
        <CampoSelector
          id="departamento"
          rotulo="Departamento"
          catalogo="departamento"
          valor={b.idDepartamento}
          onCambio={(v) => setB((antes) => ({ ...antes, idDepartamento: v, idMunicipio: '' }))}
        />
        <CampoSelector
          id="idMunicipio"
          rotulo="Municipio"
          catalogo="municipio"
          valor={b.idMunicipio}
          requisito="Elija primero el departamento"
          idDepartamento={b.idDepartamento === '' ? undefined : Number(b.idDepartamento)}
          onCambio={(v) => fijar('idMunicipio', v)}
          error={errores['idMunicipio']}
        />
      </div>

      <CoordenadasGms
        valor={b.gms}
        onCambio={(v) => fijar('gms', v)}
        errores={errores}
        {...(b.lugar !== '' ? { lugar: b.lugar } : {})}
      />

      <div className="rejilla-3">
        <CampoFecha
          id="fechaInicio"
          rotulo="Fecha de inicio"
          valor={b.fechaInicio}
          onCambio={(v) => fijar('fechaInicio', v)}
          error={errores['fechaInicio']}
        />
        <CampoFecha
          id="fechaEjecucion"
          rotulo="Fecha de ejecución"
          valor={b.fechaEjecucion}
          onCambio={(v) => fijar('fechaEjecucion', v)}
          error={errores['fechaEjecucion']}
        />
        <CampoFecha
          id="fechaFin"
          rotulo="Fecha de finalización"
          valor={b.fechaFin}
          onCambio={(v) => fijar('fechaFin', v)}
          obligatorio={false}
          ayuda="Opcional. Solo si la jornada duró más de un día."
          error={errores['fechaFin']}
        />
      </div>

      <div className="rejilla-3 rejilla-llena">
        <CampoSiNo
          id="poblacionAfectaTropa"
          rotulo="Población afecta a la tropa"
          valor={b.poblacionAfectaTropa}
          onCambio={(v) => fijar('poblacionAfectaTropa', v)}
          error={errores['poblacionAfectaTropa']}
        />
      </div>

      <Campo
        id="observaciones"
        rotulo="Observaciones"
        valor={b.observaciones}
        onCambio={(v) => fijar('observaciones', v)}
        multilinea
        ayuda="Como pide el manual: satisfacción de la población, novedades ocurridas en el desarrollo de la jornada e impacto causado."
        error={errores['observaciones']}
      />

      <div className="fila-sep seccion-pie">
        <p className="ayuda">
          {inicial === undefined
            ? 'Al guardar se genera el código de actividad y se habilitan las once pestañas.'
            : 'Corregir los datos generales no toca lo registrado en las pestañas.'}
        </p>
        <div className="fila">
          {alCancelar !== undefined && (
            <button type="button" className="boton boton-fantasma" onClick={alCancelar}>
              Cancelar
            </button>
          )}
          <button
            type="button"
            className="boton boton-primario"
            disabled={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            <Marca tamano={18} />
            {guardar.isPending
              ? 'Guardando…'
              : inicial === undefined
                ? 'Guardar y continuar'
                : 'Guardar correcciones'}
          </button>
        </div>
      </div>
    </div>
  );
}
