import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearHerramienta, formatearFechaDdMmAaaa } from '@paid/schema';
import type { HerramientaEnListado } from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useCatalogo } from '../api/catalogos';
import { useSesion } from '../api/sesion';
import { useAnuncio } from '../api/accesibilidad';
import { CampoSelector } from '../componentes/CampoSelector';
import { TablaEnvoltura } from '../componentes/TablaEnvoltura';
import { CoordenadasGms, GMS_VACIO, completarGms } from '../componentes/CoordenadasGms';
import type { BorradorGms } from '../componentes/CoordenadasGms';
import { CampoFecha } from '../componentes/CampoFecha';
import { Campo } from '../componentes/Campo';
import { CampoResponsable } from '../componentes/CampoResponsable';
import { Alerta, Cruz, Info, Lupa, Marca, Mas } from '../componentes/Iconos';

/**
 * Maestro 3 de 3 — Herramientas AID (`ai.herramienta_aid`).
 *
 * ⚠️ R13 — Este es el formulario georreferenciado **que se olvida**, porque no
 * es una actividad. Son seis los que capturan coordenadas y este es el sexto.
 * Por eso lleva el mismo componente de GMS que la jornada, con su conversión
 * visible a decimales y su botón «Ver ubicación»: si aquí se capturara de otra
 * manera, las dos formas divergirían y una de las dos estaría mal.
 *
 * Los campos siguen la lámina 46 del manual: ubicación, tipo, estado con su
 * fecha de potenciación, responsable y observaciones. Código y nombre no están
 * en el manual pero se conservan: sin ellos dos emisoras del mismo municipio
 * serían indistinguibles en el listado.
 */

interface Listado {
  readonly filas: readonly HerramientaEnListado[];
  readonly total: number;
}

const VACIO = {
  idTipoHerramientaAid: '',
  codigo: '',
  nombre: '',
  descripcion: '',
  idDepartamento: '',
  idMunicipio: '',
  idEstadoHerramienta: '',
  fechaPotenciacion: '',
  idPersonalResponsable: '',
};

export function Herramientas(): JSX.Element {
  const { puede } = useSesion();
  const anunciar = useAnuncio();
  const clienteConsultas = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(VACIO);
  const [gms, setGms] = useState<BorradorGms>(GMS_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Lámina 46: si está INACTIVA, las observaciones son obligatorias. El `id`
  // de ese estado es de la base; se reconoce por su código, que es estable.
  const estados = useCatalogo('estado_herramienta_aid');
  const idInactiva = useMemo(
    () => estados.data?.find((e) => e.codigo === 'INACTIVA')?.id,
    [estados.data],
  );
  const esInactiva = idInactiva !== undefined && borrador.idEstadoHerramienta === String(idInactiva);

  const listado = useQuery({
    queryKey: ['herramientas', busqueda],
    queryFn: () =>
      api.obtener<Listado>(
        `/herramientas${busqueda === '' ? '' : `?texto=${encodeURIComponent(busqueda)}`}`,
      ),
  });

  const registrar = useMutation({
    mutationFn: async () => {
      // Las coordenadas arrancan VACÍAS y se exigen: un valor por omisión
      // plausible es peor que ninguno (P6). Ver CoordenadasGms.
      const coordenada = completarGms(gms);
      const datos = crearHerramienta.safeParse({
        ...aPeticion(borrador),
        ...('coordenada' in coordenada ? coordenada.coordenada : {}),
      });
      const sinMotivo = esInactiva && borrador.descripcion.trim() === '';
      if (!datos.success || 'faltan' in coordenada || sinMotivo) {
        const porCampo: Record<string, string> = 'faltan' in coordenada ? { ...coordenada.faltan } : {};
        if (sinMotivo) {
          porCampo['descripcion'] =
            'Está inactiva: diga por qué y qué gestión se hizo para ponerla en funcionamiento o darla de baja.';
        }
        if (!datos.success) {
          for (const problema of datos.error.issues) {
            const clave = problema.path.join('.');
            // Con la coordenada incompleta no se envía ninguna de sus partes, y
            // el esquema reclamaría también las llenas —el hemisferio W—.
            if ('faltan' in coordenada && /^(latitud|longitud)/u.test(clave)) continue;
            porCampo[clave] ??= problema.message;
          }
        }
        setErrores(porCampo);
        throw new Error('validacion');
      }
      setErrores({});
      return api.crear<{ id: number }>('/herramientas', datos.data);
    },
    onError: (error: unknown) => {
      // Lo que solo el servidor puede comprobar (R8: el responsable visible
      // para la unidad; un tipo retirado) vuelve señalando su campo.
      if (error instanceof ErrorApi && error.porCampo.length > 0) {
        const porCampo: Record<string, string> = {};
        for (const d of error.porCampo) porCampo[d.campo] = d.mensaje;
        setErrores(porCampo);
      }
    },
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: ['herramientas'] });
      setBorrador(VACIO);
      setGms(GMS_VACIO);
      setAbierto(false);
      anunciar('Herramienta AID registrada.');
    },
  });

  const filas = listado.data?.filas ?? [];
  const errorServidor = registrar.error instanceof ErrorApi ? registrar.error : null;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Maestro 3 de 3</span>
          <h1>Herramientas AID</h1>
          <p className="pagina-descripcion">
            Las herramientas de Acción Integral y Desarrollo. Capturan coordenadas
            aunque no sean actividades: es una de las seis pantallas
            georreferenciadas, y la que se pasa por alto.
          </p>
        </div>
        {puede('HERRAMIENTA.CREAR') && (
          <button
            type="button"
            className={`boton ${abierto ? 'boton-secundario' : 'boton-primario'}`}
            aria-expanded={abierto}
            onClick={() => setAbierto((previo) => !previo)}
          >
            {abierto ? <Cruz tamano={18} /> : <Mas tamano={18} />}
            {abierto ? 'Cerrar formulario' : 'Registrar herramienta'}
          </button>
        )}
      </div>

      {abierto && (
        <section className="tarjeta seccion emerge" aria-labelledby="titulo-nueva-herramienta">
          <h2 id="titulo-nueva-herramienta">Nueva herramienta AID</h2>

          {errorServidor !== null && (
            <div className="aviso aviso-mal" role="alert">
              <span className="aviso-icono">
                <Alerta tamano={18} />
              </span>
              <p>{errorServidor.message}</p>
            </div>
          )}

          <div className="rejilla-2">
            <Campo
              id="codigo-herramienta"
              rotulo="Código"
              valor={borrador.codigo}
              obligatorio
              datos
              ayuda="Identificador único de la herramienta en la Fuerza."
              error={errores['codigo']}
              onCambio={(v) => setBorrador({ ...borrador, codigo: v })}
            />
            <Campo
              id="nombre-herramienta"
              rotulo="Nombre"
              valor={borrador.nombre}
              obligatorio
              error={errores['nombre']}
              onCambio={(v) => setBorrador({ ...borrador, nombre: v })}
            />
            <CampoSelector
              id="departamento-herramienta"
              rotulo="Departamento"
              catalogo="departamento"
              valor={borrador.idDepartamento}
              onCambio={(v) =>
                setBorrador({ ...borrador, idDepartamento: v, idMunicipio: '' })
              }
            />
            <CampoSelector
              id="municipio-herramienta"
              rotulo="Municipio"
              catalogo="municipio"
              valor={borrador.idMunicipio}
              requisito="Elija primero el departamento"
              idDepartamento={
                borrador.idDepartamento === '' ? undefined : Number(borrador.idDepartamento)
              }
              onCambio={(v) => setBorrador({ ...borrador, idMunicipio: v })}
              error={errores['idMunicipio']}
            />
          </div>

          <CoordenadasGms
            valor={gms}
            onCambio={setGms}
            errores={errores}
            lugar={borrador.nombre}
          />

          {/* ── Lámina 46: tipo, estado, potenciación y responsable ────── */}
          <div className="aviso aviso-info">
            <span className="aviso-icono">
              <Info tamano={17} />
            </span>
            <p>
              El manual dice que al elegir el tipo se activan campos propios de cada
              herramienta. Esos campos todavía no los ha definido JACID (Q3): por ahora
              regístrelos en las observaciones.
            </p>
          </div>

          <div className="rejilla-2">
            <CampoSelector
              id="tipo-herramienta"
              rotulo="Tipo de herramienta"
              catalogo="tipo_herramienta_aid"
              valor={borrador.idTipoHerramientaAid}
              obligatorio
              onCambio={(v) => setBorrador({ ...borrador, idTipoHerramientaAid: v })}
              error={errores['idTipoHerramientaAid']}
            />
            <CampoSelector
              id="estado-herramienta"
              rotulo="Estado de la herramienta"
              catalogo="estado_herramienta_aid"
              valor={borrador.idEstadoHerramienta}
              obligatorio
              ayuda="Si está inactiva, las observaciones deben decir por qué."
              onCambio={(v) => setBorrador({ ...borrador, idEstadoHerramienta: v })}
              error={errores['idEstadoHerramienta']}
            />
            <CampoFecha
              id="fecha-potenciacion"
              rotulo="Fecha de potenciación"
              valor={borrador.fechaPotenciacion}
              ayuda="Cuando se potenció la herramienta; si nunca se repotenció, cuando se adquirió."
              error={errores['fechaPotenciacion']}
              onCambio={(v) => setBorrador({ ...borrador, fechaPotenciacion: v })}
            />
            <CampoResponsable
              id="responsable-herramienta"
              valor={borrador.idPersonalResponsable}
              onCambio={(v) => setBorrador({ ...borrador, idPersonalResponsable: v })}
              error={errores['idPersonalResponsable']}
            />
          </div>

          <Campo
            id="descripcion-herramienta"
            rotulo="Observaciones"
            valor={borrador.descripcion}
            obligatorio={esInactiva}
            multilinea
            ayuda={
              esInactiva
                ? 'Obligatorias: por qué está inactiva y qué gestión se hizo para ponerla en funcionamiento o darla de baja.'
                : 'Código de inventario fiscal, fecha de adquisición, número de serie.'
            }
            error={errores['descripcion']}
            onCambio={(v) => setBorrador({ ...borrador, descripcion: v })}
          />

          <div className="fila-sep seccion-pie">
            <p className="ayuda">
              Las coordenadas se guardan en grados-minutos-segundos tal como las
              escribió. Las decimales se derivan: no se pueden separar de lo digitado.
            </p>
            <button
              type="button"
              className="boton boton-primario"
              disabled={registrar.isPending}
              onClick={() => registrar.mutate()}
            >
              <Marca tamano={18} />
              {registrar.isPending ? 'Guardando…' : 'Guardar herramienta'}
            </button>
          </div>
        </section>
      )}

      <div className="filtros tarjeta" style={{ marginTop: abierto ? 'var(--e-5)' : 0 }}>
        <div className="campo crecer">
          <label htmlFor="buscar-herramienta">Buscar por nombre o código</label>
          <div className="buscador">
            <input
              id="buscar-herramienta"
              className="entrada"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBusqueda(texto.trim());
              }}
            />
            <button
              type="button"
              className="boton boton-secundario"
              onClick={() => setBusqueda(texto.trim())}
            >
              <Lupa tamano={17} />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {listado.isSuccess && filas.length === 0 && (
        <div className="tarjeta vacio">
          <h3>
            {busqueda === ''
              ? 'Todavía no hay herramientas AID registradas'
              : 'Ninguna herramienta coincide'}
          </h3>
          <p>
            {busqueda === ''
              ? 'Es el tercero de los tres maestros de precedencia: sin al menos una herramienta no se puede registrar una actividad que la use.'
              : 'Pruebe con parte del nombre.'}
          </p>
        </div>
      )}

      {listado.isSuccess && filas.length > 0 && (
        <>
          <p className="conteo">
            {listado.data.total} herramienta{listado.data.total === 1 ? '' : 's'}
          </p>
          <TablaEnvoltura nombre="Herramientas AID registradas">
            <table className="tabla">
              <caption className="solo-lectores">
                Herramientas de Acción Integral y Desarrollo, con su georreferenciación.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Herramienta</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha P.</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Municipio</th>
                  <th scope="col">Coordenadas</th>
                </tr>
              </thead>
              <tbody className="escalonado">
                {filas.map((fila) => (
                  <tr key={fila.id}>
                    <td className="datos">{fila.codigo}</td>
                    <td>
                      <strong>{fila.nombre}</strong>
                      <p className="celda-sub">{fila.unidad}</p>
                    </td>
                    <td>{fila.tipo}</td>
                    {/* Lámina 45. NULL en las herramientas anteriores a 0016. */}
                    <td>
                      {fila.estado === null ? (
                        <span className="sin-dato">Sin registrar</span>
                      ) : (
                        <span
                          className={`distintivo ${fila.estado === 'Activa' ? 'distintivo-completo' : 'distintivo-incompleto'}`}
                        >
                          {fila.estado}
                        </span>
                      )}
                    </td>
                    <td className="datos">
                      {fila.fechaPotenciacion === null ? (
                        <span className="sin-dato">—</span>
                      ) : (
                        formatearFechaDdMmAaaa(fila.fechaPotenciacion)
                      )}
                    </td>
                    <td>
                      {fila.responsable === null ? (
                        <span className="sin-dato">Sin registrar</span>
                      ) : (
                        <>
                          {fila.responsable.nombre}
                          <p className="celda-sub datos">{fila.responsable.documento}</p>
                          {(fila.responsable.correo !== null || fila.responsable.telefono !== null) && (
                            <p className="celda-sub">
                              {[fila.responsable.correo, fila.responsable.telefono]
                                .filter((x) => x !== null)
                                .join(' · ')}
                            </p>
                          )}
                        </>
                      )}
                    </td>
                    <td>{fila.municipio ?? <span className="celda-sub">—</span>}</td>
                    <td className="datos celda-coord">
                      {fila.latitudDecimal.toFixed(4)}
                      <br />
                      {fila.longitudDecimal.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaEnvoltura>
        </>
      )}
    </>
  );
}

function aPeticion(borrador: typeof VACIO): Record<string, unknown> {
  const limpio = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const peticion: Record<string, unknown> = {
    idTipoHerramientaAid: limpio(borrador.idTipoHerramientaAid),
    codigo: borrador.codigo.trim(),
    nombre: borrador.nombre.trim(),
    fechaPotenciacion: borrador.fechaPotenciacion.trim(),
  };
  for (const [clave, valor] of [
    ['descripcion', borrador.descripcion],
    ['idMunicipio', borrador.idMunicipio],
    ['idEstadoHerramienta', borrador.idEstadoHerramienta],
    ['idPersonalResponsable', borrador.idPersonalResponsable],
  ] as const) {
    const depurado = limpio(valor);
    if (depurado !== undefined) peticion[clave] = depurado;
  }
  return peticion;
}
