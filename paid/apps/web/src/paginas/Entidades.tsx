import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearEntidad } from '@paid/schema';
import type { EntidadEnListado, EntidadSemejante } from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { useAnuncio } from '../api/accesibilidad';
import { CampoSelector } from '../componentes/CampoSelector';
import { TablaEnvoltura } from '../componentes/TablaEnvoltura';
import { Campo } from '../componentes/Campo';
import { Alerta, Cruz, Info, Lupa, Marca, Mas } from '../componentes/Iconos';

/**
 * Maestro 2 de 3 — Entidades A.I. (`ai.entidad`).
 *
 * ⚠️ Esta pantalla es la única de la Fase 4 con un requisito propio:
 * «Entidades A.I. **con sugerencia de duplicados por semejanza antes de
 * guardar**».
 *
 * Por qué no es una comodidad: `ai.entidad` es un maestro de precedencia, y
 * cada actividad apunta a una de estas filas. Si «ALCALDÍA DE TUMACO» queda
 * registrada dos veces, las actividades se reparten entre las dos y los
 * consolidados del RAO también. No falla nada visible: salen dos cifras donde
 * debía salir una, y cada una parece correcta.
 *
 * ── Cuatro decisiones de esta pantalla ──────────────────────────────────────
 *
 * 1. LA CONSULTA VA MIENTRAS SE ESCRIBE, con 350 ms de espera. «Antes de
 *    guardar» se cumpliría también avisando al pulsar el botón, pero entonces
 *    la persona ya escribió los ocho campos: el aviso llega cuando abandonarlo
 *    cuesta. Al tercer carácter del nombre no cuesta nada.
 *
 * 2. LA SUGERENCIA NO BLOQUEA POR SÍ SOLA. Puede haber dos juntas de acción
 *    comunal con nombres casi iguales en municipios distintos, y son dos
 *    entidades. Quien decide es la persona, y para eso necesita ver el
 *    municipio y la unidad de cada candidata — no solo el nombre.
 *
 * 3. POR ENCIMA DEL UMBRAL DE BLOQUEO SÍ HAY QUE CONFIRMAR, con una casilla
 *    explícita. Y el servidor lo vuelve a comprobar: si solo lo hiciera la
 *    pantalla, un POST directo se saltaría la deduplicación entera.
 *
 * 4. LA CASILLA SE DESMARCA al cambiar el nombre. Confirmar «no es duplicada»
 *    y luego editar el nombre dejaría en pie una confirmación sobre un texto
 *    que ya no es el que se revisó.
 */

interface Listado {
  readonly filas: readonly EntidadEnListado[];
  readonly total: number;
}

interface Semejanzas {
  readonly candidatas: readonly EntidadSemejante[];
  readonly umbralAviso: number;
  readonly umbralBloqueo: number;
}

const VACIO = {
  idTipoEntidad: '',
  nombre: '',
  nit: '',
  idDepartamento: '',
  idMunicipio: '',
  direccion: '',
  telefono: '',
  correo: '',
  contacto: '',
};

export function Entidades(): JSX.Element {
  const { puede } = useSesion();
  const anunciar = useAnuncio();
  const clienteConsultas = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmado, setConfirmado] = useState(false);
  const [nombreReposado, setNombreReposado] = useState('');

  const listado = useQuery({
    queryKey: ['entidades', busqueda],
    queryFn: () =>
      api.obtener<Listado>(
        `/entidades${busqueda === '' ? '' : `?texto=${encodeURIComponent(busqueda)}`}`,
      ),
  });

  /*
   * Espera antes de consultar. Sin ella se dispara una petición por tecla: en
   * la Intranet ARC eso es carga innecesaria, y en la pantalla es una lista de
   * candidatas que parpadea y no se puede leer.
   */
  useEffect(() => {
    const temporizador = window.setTimeout(() => setNombreReposado(borrador.nombre.trim()), 350);
    return () => window.clearTimeout(temporizador);
  }, [borrador.nombre]);

  const semejantes = useQuery({
    queryKey: ['entidades-semejantes', nombreReposado],
    queryFn: () =>
      api.obtener<Semejanzas>(
        `/entidades/semejantes?nombre=${encodeURIComponent(nombreReposado)}`,
      ),
    enabled: abierto && nombreReposado.length >= 3,
    // Sin reintentos: si falla, se avisa y se deja guardar. Un maestro que no
    // se puede alimentar porque la sugerencia no responde sería peor.
    retry: false,
  });

  const candidatas = semejantes.data?.candidatas ?? [];
  const umbralBloqueo = semejantes.data?.umbralBloqueo ?? 1;
  const bloqueantes = useMemo(
    () => candidatas.filter((c) => c.mismoNombre || c.semejanza >= umbralBloqueo),
    [candidatas, umbralBloqueo],
  );
  const exigeConfirmacion = bloqueantes.length > 0;

  const registrar = useMutation({
    mutationFn: async () => {
      const datos = crearEntidad.safeParse({ ...aPeticion(borrador), confirmoNoEsDuplicado: confirmado });
      if (!datos.success) {
        const porCampo: Record<string, string> = {};
        for (const problema of datos.error.issues) {
          porCampo[problema.path.join('.')] = problema.message;
        }
        setErrores(porCampo);
        throw new Error('validacion');
      }
      setErrores({});
      return api.crear<{ id: number }>('/entidades', datos.data);
    },
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: ['entidades'] });
      setBorrador(VACIO);
      setConfirmado(false);
      setAbierto(false);
      anunciar('Entidad registrada.');
    },
  });

  // Cambiar el nombre invalida la confirmación: lo revisado ya no es lo que
  // se va a guardar.
  function cambiarNombre(nombre: string): void {
    setBorrador({ ...borrador, nombre });
    if (confirmado) setConfirmado(false);
  }

  const filas = listado.data?.filas ?? [];
  const errorServidor = registrar.error instanceof ErrorApi ? registrar.error : null;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Maestro 2 de 3</span>
          <h1>Entidades A.I.</h1>
          <p className="pagina-descripcion">
            Las entidades con las que se ejecuta acción integral. Antes de guardar se
            buscan nombres parecidos: una entidad registrada dos veces reparte entre las
            dos lo que debía sumar junto en los consolidados.
          </p>
        </div>
        {puede('ENTIDAD.CREAR') && (
          <button
            type="button"
            className={`boton ${abierto ? 'boton-secundario' : 'boton-primario'}`}
            aria-expanded={abierto}
            onClick={() => setAbierto((previo) => !previo)}
          >
            {abierto ? <Cruz tamano={18} /> : <Mas tamano={18} />}
            {abierto ? 'Cerrar formulario' : 'Registrar entidad'}
          </button>
        )}
      </div>

      {abierto && (
        <section className="tarjeta seccion emerge" aria-labelledby="titulo-nueva-entidad">
          <h2 id="titulo-nueva-entidad">Nueva entidad</h2>

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
              id="nombre-entidad"
              rotulo="Nombre de la entidad"
              valor={borrador.nombre}
              obligatorio
              ayuda="Escríbalo completo. Con tres letras ya se buscan entidades parecidas."
              error={errores['nombre']}
              onCambio={cambiarNombre}
            />
            <CampoSelector
              id="tipo-entidad"
              rotulo="Tipo de entidad"
              catalogo="tipo_entidad"
              valor={borrador.idTipoEntidad}
              obligatorio
              onCambio={(v) => setBorrador({ ...borrador, idTipoEntidad: v })}
              error={errores['idTipoEntidad']}
            />
          </div>

          {/* ── La sugerencia de duplicados ──────────────────────────────── */}
          <SugerenciaDuplicados
            candidatas={candidatas}
            umbralBloqueo={umbralBloqueo}
            consultando={semejantes.isFetching}
            fallo={semejantes.isError}
            confirmado={confirmado}
            onConfirmar={setConfirmado}
          />

          <div className="rejilla-2">
            <Campo
              id="nit"
              rotulo="NIT"
              valor={borrador.nit}
              datos
              ayuda="Opcional: hay entidades sin NIT. Si no lo tiene, déjelo en blanco — no lo invente."
              error={errores['nit']}
              onCambio={(v) => setBorrador({ ...borrador, nit: v })}
            />
            <Campo
              id="contacto"
              rotulo="Persona de contacto"
              valor={borrador.contacto}
              error={errores['contacto']}
              onCambio={(v) => setBorrador({ ...borrador, contacto: v })}
            />
            <CampoSelector
              id="departamento-entidad"
              rotulo="Departamento"
              catalogo="departamento"
              valor={borrador.idDepartamento}
              ayuda="Se elige primero para acotar los municipios."
              onCambio={(v) =>
                setBorrador({ ...borrador, idDepartamento: v, idMunicipio: '' })
              }
            />
            <CampoSelector
              id="municipio-entidad"
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
            <Campo
              id="direccion"
              rotulo="Dirección"
              valor={borrador.direccion}
              error={errores['direccion']}
              onCambio={(v) => setBorrador({ ...borrador, direccion: v })}
            />
            <Campo
              id="telefono-entidad"
              rotulo="Teléfono"
              valor={borrador.telefono}
              datos
              error={errores['telefono']}
              onCambio={(v) => setBorrador({ ...borrador, telefono: v })}
            />
            <Campo
              id="correo-entidad"
              rotulo="Correo"
              valor={borrador.correo}
              tipo="email"
              error={errores['correo']}
              onCambio={(v) => setBorrador({ ...borrador, correo: v })}
            />
          </div>

          <div className="fila-sep seccion-pie">
            <p className="ayuda">
              {exigeConfirmacion && !confirmado
                ? 'Hay entidades que pueden ser la misma. Revíselas y confirme arriba para poder guardar.'
                : 'La entidad se registra en su unidad. Otras unidades no la verán.'}
            </p>
            <button
              type="button"
              className="boton boton-primario"
              disabled={registrar.isPending || (exigeConfirmacion && !confirmado)}
              onClick={() => registrar.mutate()}
            >
              <Marca tamano={18} />
              {registrar.isPending ? 'Guardando…' : 'Guardar entidad'}
            </button>
          </div>
        </section>
      )}

      <div className="filtros tarjeta" style={{ marginTop: abierto ? 'var(--e-5)' : 0 }}>
        <div className="campo crecer">
          <label htmlFor="buscar-entidad">Buscar por nombre o NIT</label>
          <div className="buscador">
            <input
              id="buscar-entidad"
              className="entrada"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBusqueda(texto.trim());
              }}
              placeholder="Por ejemplo: alcaldía, o 800123456"
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
          <p className="ayuda">
            La búsqueda ignora tildes y mayúsculas: «alcaldia» encuentra «Alcaldía».
          </p>
        </div>
      </div>

      {listado.isSuccess && filas.length === 0 && (
        <div className="tarjeta vacio">
          <h3>
            {busqueda === ''
              ? 'Todavía no hay entidades registradas'
              : 'Ninguna entidad coincide'}
          </h3>
          <p>
            {busqueda === ''
              ? 'Sin al menos una entidad no se puede registrar una actividad: es el segundo de los tres maestros de precedencia.'
              : 'Pruebe con una palabra del nombre en lugar del nombre completo.'}
          </p>
        </div>
      )}

      {listado.isSuccess && filas.length > 0 && (
        <>
          <p className="conteo">
            {listado.data.total} entidad{listado.data.total === 1 ? '' : 'es'}
          </p>
          <TablaEnvoltura nombre="Entidades A.I. registradas">
            <table className="tabla">
              <caption className="solo-lectores">
                Entidades de Acción Integral registradas en el ámbito de su unidad.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Entidad</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">NIT</th>
                  <th scope="col">Municipio</th>
                  <th scope="col">Contacto</th>
                </tr>
              </thead>
              <tbody className="escalonado">
                {filas.map((fila) => (
                  <tr key={fila.id}>
                    <td>
                      <strong>{fila.nombre}</strong>
                      <p className="celda-sub">{fila.unidad}</p>
                    </td>
                    <td>{fila.tipo}</td>
                    <td className="datos">{fila.nit ?? <span className="celda-sub">—</span>}</td>
                    <td>{fila.municipio ?? <span className="celda-sub">—</span>}</td>
                    <td>
                      {fila.contacto ?? <span className="celda-sub">—</span>}
                      {fila.telefono !== null && (
                        <p className="celda-sub datos">{fila.telefono}</p>
                      )}
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

/**
 * El panel de candidatas.
 *
 * `aria-live="polite"` porque el contenido aparece sin que la persona haga
 * nada: sin eso, quien usa lector de pantalla escribe el nombre y no se entera
 * de que hay tres entidades parecidas.
 */
function SugerenciaDuplicados({
  candidatas,
  umbralBloqueo,
  consultando,
  fallo,
  confirmado,
  onConfirmar,
}: {
  readonly candidatas: readonly EntidadSemejante[];
  readonly umbralBloqueo: number;
  readonly consultando: boolean;
  readonly fallo: boolean;
  readonly confirmado: boolean;
  readonly onConfirmar: (valor: boolean) => void;
}): JSX.Element | null {
  const bloqueantes = candidatas.filter((c) => c.mismoNombre || c.semejanza >= umbralBloqueo);

  if (fallo) {
    return (
      <div className="aviso aviso-ojo" role="status">
        <span className="aviso-icono">
          <Alerta tamano={17} />
        </span>
        <p>
          No se pudo revisar si ya existe una entidad parecida. Puede guardar, pero
          busque primero en el listado: el sistema no lo comprobó por usted.
        </p>
      </div>
    );
  }

  if (candidatas.length === 0) {
    return consultando ? (
      <p className="ayuda" role="status">
        Buscando entidades parecidas…
      </p>
    ) : null;
  }

  return (
    <section className="similitud" aria-live="polite" aria-labelledby="titulo-semejantes">
      <div className="fila">
        <Info tamano={18} />
        <h3 id="titulo-semejantes" style={{ fontSize: 'var(--t-lg)' }}>
          {bloqueantes.length > 0
            ? 'Puede que esta entidad ya esté registrada'
            : 'Hay entidades con nombre parecido'}
        </h3>
      </div>
      <p className="ayuda">
        {bloqueantes.length > 0
          ? 'Revise si alguna es la misma. Si lo es, use esa en lugar de crear otra; una entidad duplicada divide las cifras del consolidado.'
          : 'Solo para que las vea. Si ninguna es la misma, siga: no hace falta confirmar nada.'}
      </p>

      <ul className="similitud-lista">
        {candidatas.map((candidata) => (
          <li key={candidata.id} className="similitud-fila">
            <div>
              <span className="similitud-nombre">{candidata.nombre}</span>
              <p className="similitud-meta">
                {candidata.tipo}
                {candidata.municipio !== null && ` · ${candidata.municipio}`}
                {candidata.nit !== null && ` · NIT ${candidata.nit}`} · {candidata.unidad}
              </p>
            </div>
            <span className="similitud-grado">
              {candidata.mismoNombre ? (
                <>
                  <span aria-hidden="true">Nombre idéntico</span>
                  <span className="solo-lectores">
                    El nombre coincide exactamente al ignorar tildes y mayúsculas.
                  </span>
                </>
              ) : (
                `${Math.round(candidata.semejanza * 100)}% de parecido`
              )}
            </span>
          </li>
        ))}
      </ul>

      {bloqueantes.length > 0 && (
        <label className="interruptor">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => onConfirmar(e.target.checked)}
          />
          <span className="interruptor-pista" aria-hidden="true" />
          <span>
            Las revisé y esta entidad es distinta de{' '}
            {bloqueantes.length === 1 ? 'la anterior' : `las ${bloqueantes.length} anteriores`}
          </span>
        </label>
      )}
    </section>
  );
}

/** Cadenas vacías fuera: ausente y «en blanco» no son lo mismo. */
function aPeticion(borrador: typeof VACIO): Record<string, unknown> {
  const limpio = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const peticion: Record<string, unknown> = {
    idTipoEntidad: limpio(borrador.idTipoEntidad),
    nombre: borrador.nombre.trim(),
  };
  for (const [clave, valor] of [
    ['nit', borrador.nit],
    ['idMunicipio', borrador.idMunicipio],
    ['direccion', borrador.direccion],
    ['telefono', borrador.telefono],
    ['correo', borrador.correo],
    ['contacto', borrador.contacto],
  ] as const) {
    const depurado = limpio(valor);
    if (depurado !== undefined) peticion[clave] = depurado;
  }
  return peticion;
}
