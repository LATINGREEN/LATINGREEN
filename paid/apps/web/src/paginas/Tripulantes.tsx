import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearPersonal } from '@paid/schema';
import type { PersonalEnListado } from '@paid/schema';
import { ErrorApi, api } from '../api/cliente';
import { useSesion } from '../api/sesion';
import { useAnuncio } from '../api/accesibilidad';
import { Campo } from '../componentes/Campo';
import { CampoSelector } from '../componentes/CampoSelector';
import { TablaEnvoltura } from '../componentes/TablaEnvoltura';
import { Alerta, Cruz, Lupa, Marca, Mas } from '../componentes/Iconos';

/**
 * Maestro 1 de 3 — Tripulantes A.I. (`ai.personal`).
 *
 * El formulario se abre bajo demanda y no está siempre desplegado: la acción
 * frecuente es BUSCAR a alguien que ya está, no registrar a alguien nuevo. Un
 * formulario abierto invita a registrar de nuevo lo que ya existe, y el
 * duplicado en un maestro de precedencia es el defecto que más cuesta
 * deshacer.
 */

interface Listado {
  readonly filas: readonly PersonalEnListado[];
  readonly total: number;
}

const VACIO = {
  idTipoDocumentoIdentidad: '',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  idGrado: '',
  idEscalafon: '',
  correo: '',
  telefono: '',
};

export function Tripulantes(): JSX.Element {
  const { puede } = useSesion();
  const anunciar = useAnuncio();
  const clienteConsultas = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const listado = useQuery({
    queryKey: ['personal', busqueda],
    queryFn: () =>
      api.obtener<Listado>(
        `/personal${busqueda === '' ? '' : `?texto=${encodeURIComponent(busqueda)}`}`,
      ),
  });

  const registrar = useMutation({
    mutationFn: async () => {
      // Se valida con el MISMO esquema Zod que validará el servidor. Si aquí
      // pasara algo que allá no, la pantalla estaría mintiendo.
      const datos = crearPersonal.safeParse(aPeticion(borrador));
      if (!datos.success) {
        const porCampo: Record<string, string> = {};
        for (const problema of datos.error.issues) {
          porCampo[problema.path.join('.')] = problema.message;
        }
        setErrores(porCampo);
        throw new Error('validacion');
      }
      setErrores({});
      return api.crear<{ id: number }>('/personal', datos.data);
    },
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: ['personal'] });
      setBorrador(VACIO);
      setAbierto(false);
      anunciar('Tripulante registrado.');
    },
  });

  const filas = listado.data?.filas ?? [];
  const errorServidor =
    registrar.error instanceof ErrorApi ? registrar.error : null;

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <span className="rotulo">Maestro 1 de 3</span>
          <h1>Tripulantes A.I.</h1>
          <p className="pagina-descripcion">
            El personal que ejecuta las actividades. Es uno de los tres maestros que
            deben existir antes de registrar cualquier actividad.
          </p>
        </div>
        {puede('PERSONAL.CREAR') && (
          <button
            type="button"
            className={`boton ${abierto ? 'boton-secundario' : 'boton-primario'}`}
            aria-expanded={abierto}
            onClick={() => setAbierto((previo) => !previo)}
          >
            {abierto ? <Cruz tamano={18} /> : <Mas tamano={18} />}
            {abierto ? 'Cerrar formulario' : 'Registrar tripulante'}
          </button>
        )}
      </div>

      {abierto && (
        <section className="tarjeta seccion emerge" aria-labelledby="titulo-nuevo-tripulante">
          <h2 id="titulo-nuevo-tripulante">Nuevo tripulante</h2>

          {errorServidor !== null && (
            <div className="aviso aviso-mal" role="alert">
              <span className="aviso-icono">
                <Alerta tamano={18} />
              </span>
              <p>{errorServidor.message}</p>
            </div>
          )}

          <div className="rejilla-2">
            <CampoSelector
              id="tipo-documento"
              rotulo="Tipo de documento"
              catalogo="tipo_documento_identidad"
              valor={borrador.idTipoDocumentoIdentidad}
              obligatorio
              onCambio={(v) => setBorrador({ ...borrador, idTipoDocumentoIdentidad: v })}
              error={errores['idTipoDocumentoIdentidad']}
            />
            <Campo
              id="numero-documento"
              rotulo="Número de documento"
              valor={borrador.numeroDocumento}
              obligatorio
              datos
              ayuda="Sin puntos ni espacios. Por ejemplo: 1030512345."
              error={errores['numeroDocumento']}
              onCambio={(v) => setBorrador({ ...borrador, numeroDocumento: v })}
            />
            <Campo
              id="nombres"
              rotulo="Nombres"
              valor={borrador.nombres}
              obligatorio
              error={errores['nombres']}
              onCambio={(v) => setBorrador({ ...borrador, nombres: v })}
            />
            <Campo
              id="apellidos"
              rotulo="Apellidos"
              valor={borrador.apellidos}
              obligatorio
              error={errores['apellidos']}
              onCambio={(v) => setBorrador({ ...borrador, apellidos: v })}
            />
            <CampoSelector
              id="grado"
              rotulo="Grado"
              catalogo="grado"
              valor={borrador.idGrado}
              onCambio={(v) => setBorrador({ ...borrador, idGrado: v })}
              error={errores['idGrado']}
            />
            <CampoSelector
              id="escalafon"
              rotulo="Escalafón"
              catalogo="escalafon"
              valor={borrador.idEscalafon}
              onCambio={(v) => setBorrador({ ...borrador, idEscalafon: v })}
              error={errores['idEscalafon']}
            />
            <Campo
              id="correo"
              rotulo="Correo institucional"
              valor={borrador.correo}
              tipo="email"
              error={errores['correo']}
              onCambio={(v) => setBorrador({ ...borrador, correo: v })}
            />
            <Campo
              id="telefono"
              rotulo="Teléfono"
              valor={borrador.telefono}
              datos
              error={errores['telefono']}
              onCambio={(v) => setBorrador({ ...borrador, telefono: v })}
            />
          </div>

          <div className="fila-sep seccion-pie">
            <p className="ayuda">
              La unidad se toma de su sesión: un tripulante se registra en la unidad de
              quien lo registra.
            </p>
            <button
              type="button"
              className="boton boton-primario"
              disabled={registrar.isPending}
              onClick={() => registrar.mutate()}
            >
              <Marca tamano={18} />
              {registrar.isPending ? 'Guardando…' : 'Guardar tripulante'}
            </button>
          </div>
        </section>
      )}

      <div className="filtros tarjeta" style={{ marginTop: abierto ? 'var(--e-5)' : 0 }}>
        <div className="campo crecer">
          <label htmlFor="buscar-personal">Buscar por apellidos, nombres o documento</label>
          <div className="buscador">
            <input
              id="buscar-personal"
              className="entrada"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBusqueda(texto.trim());
              }}
              placeholder="Por ejemplo: Rodríguez, o 1030512345"
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

      {listado.isError && (
        <div className="aviso aviso-mal" role="alert">
          <span className="aviso-icono">
            <Alerta tamano={18} />
          </span>
          <p>
            {listado.error instanceof ErrorApi
              ? listado.error.message
              : 'No se pudo cargar el listado.'}
          </p>
        </div>
      )}

      {listado.isSuccess && filas.length === 0 && (
        <div className="tarjeta vacio">
          <h3>
            {busqueda === ''
              ? 'Todavía no hay tripulantes registrados'
              : 'Ningún tripulante coincide'}
          </h3>
          <p>
            {busqueda === ''
              ? 'Sin al menos un tripulante no se puede registrar una actividad: es el primero de los tres maestros de precedencia.'
              : 'Pruebe con menos letras del apellido, o con el número de documento completo.'}
          </p>
        </div>
      )}

      {listado.isSuccess && filas.length > 0 && (
        <>
          <p className="conteo">
            {listado.data.total} tripulante{listado.data.total === 1 ? '' : 's'}
          </p>
          <TablaEnvoltura nombre="Tripulantes A.I. registrados">
            <table className="tabla">
              <caption className="solo-lectores">
                Tripulantes de Acción Integral registrados en el ámbito de su unidad.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Documento</th>
                  <th scope="col">Apellidos y nombres</th>
                  <th scope="col">Grado</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Contacto</th>
                </tr>
              </thead>
              <tbody className="escalonado">
                {filas.map((fila) => (
                  <tr key={fila.id}>
                    <td className="datos">
                      {fila.numeroDocumento}
                      <p className="celda-sub">{fila.tipoDocumento}</p>
                    </td>
                    <td>
                      <strong>{fila.apellidos}</strong> {fila.nombres}
                      {fila.escalafon !== null && (
                        <p className="celda-sub">{fila.escalafon}</p>
                      )}
                    </td>
                    <td>{fila.grado ?? <span className="celda-sub">—</span>}</td>
                    <td>{fila.unidad}</td>
                    <td>
                      {fila.correo ?? <span className="celda-sub">—</span>}
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
 * Del borrador de la pantalla a la petición.
 *
 * Las cadenas vacías se convierten en `undefined` y NO se envían. La
 * diferencia importa: `correo: ''` no es un correo válido y el servidor lo
 * rechazaría, mientras que ausente significa «no tiene», que es lo que el
 * usuario quiso decir al dejarlo en blanco.
 */
function aPeticion(borrador: typeof VACIO): Record<string, unknown> {
  const limpio = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const peticion: Record<string, unknown> = {
    idTipoDocumentoIdentidad: limpio(borrador.idTipoDocumentoIdentidad),
    numeroDocumento: borrador.numeroDocumento.trim(),
    nombres: borrador.nombres.trim(),
    apellidos: borrador.apellidos.trim(),
  };
  for (const [clave, valor] of [
    ['idGrado', borrador.idGrado],
    ['idEscalafon', borrador.idEscalafon],
    ['correo', borrador.correo],
    ['telefono', borrador.telefono],
  ] as const) {
    const depurado = limpio(valor);
    if (depurado !== undefined) peticion[clave] = depurado;
  }
  return peticion;
}
