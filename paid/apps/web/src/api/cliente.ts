import { CABECERA_TESTIGO, MENSAJE_CREDENCIALES_INVALIDAS } from '@paid/schema';
import type { RespuestaError } from '@paid/schema';

/**
 * Cliente de la API.
 *
 * Tres cosas que resuelve en un solo sitio, para que ninguna pantalla tenga
 * que acordarse:
 *
 *   1. El testigo de sesión viaja en su cabecera en cada petición.
 *   2. La respuesta de error uniforme `{ codigo, mensaje, detalles?,
 *      idCorrelacion }` se convierte en un `ErrorApi` con esos campos, de modo
 *      que la interfaz pueda mostrar el mensaje del servidor —que ya está
 *      redactado para una persona— y el `idCorrelacion` para reportar.
 *   3. Un 401 no se trata como un error más: significa que la sesión venció
 *      (R1) y hay que volver al ingreso. Se avisa por un `oyente` para que el
 *      contexto de sesión reaccione sin que cada pantalla lo repita.
 */

export class ErrorApi extends Error {
  readonly codigo: string;
  readonly estado: number;
  readonly idCorrelacion: string;
  readonly detalles: unknown;

  constructor(estado: number, cuerpo: Partial<RespuestaError>) {
    super(cuerpo.mensaje ?? 'Ocurrió un error inesperado.');
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = cuerpo.codigo ?? 'ERR_DESCONOCIDO';
    this.idCorrelacion = cuerpo.idCorrelacion ?? '';
    this.detalles = cuerpo.detalles;
  }

  /** ¿Es un fallo de validación con detalle por campo? */
  get porCampo(): readonly { campo: string; mensaje: string }[] {
    if (!Array.isArray(this.detalles)) return [];
    return this.detalles.filter(
      (d): d is { campo: string; mensaje: string } =>
        typeof d === 'object' && d !== null && 'campo' in d && 'mensaje' in d,
    );
  }
}

let testigoActual: string | null = null;
const oyentesSesionVencida = new Set<() => void>();

export function fijarTestigo(testigo: string | null): void {
  testigoActual = testigo;
}

export function alVencerSesion(oyente: () => void): () => void {
  oyentesSesionVencida.add(oyente);
  return () => oyentesSesionVencida.delete(oyente);
}

interface OpcionesPeticion {
  readonly metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly cuerpo?: unknown;
  /** Para subir archivos: se manda tal cual, sin `Content-Type`. */
  readonly formulario?: FormData;
  /** Para descargas: devuelve el `Blob` en lugar de JSON. */
  readonly comoArchivo?: boolean;
}

/**
 * El transporte. En la compilación de demostración (`vite build --mode demo`)
 * las peticiones las atiende un servidor simulado que corre en el navegador
 * (`demo/servidor.ts`); en cualquier otro modo, la red. La condición la
 * resuelve Vite al compilar, así que el servidor simulado no llega nunca al
 * paquete de producción.
 */
const enviar = (url: string, init: RequestInit): Promise<Response> =>
  import.meta.env.MODE === 'demo'
    ? import('../demo/servidor').then((m) => m.fetchDemo(url, init))
    : fetch(url, init);

async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const cabeceras: Record<string, string> = {};
  if (testigoActual !== null) cabeceras[CABECERA_TESTIGO] = testigoActual;
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  let respuesta: Response;
  try {
    respuesta = await enviar(`/api${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: cabeceras,
      ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {}),
      ...(opciones.formulario !== undefined ? { body: opciones.formulario } : {}),
    });
  } catch {
    /*
     * La red cayó, o el servidor no está. En la Intranet ARC esto es un caso
     * real, no teórico: el mensaje tiene que decir qué hacer, no «Failed to
     * fetch».
     */
    throw new ErrorApi(0, {
      codigo: 'RED_SIN_RESPUESTA',
      mensaje:
        'No se pudo contactar el servidor. Verifique la conexión a la Intranet ' +
        'y vuelva a intentar.',
    });
  }

  if (respuesta.status === 401) {
    for (const oyente of oyentesSesionVencida) oyente();
  }

  if (!respuesta.ok) {
    let cuerpo: Partial<RespuestaError> = {};
    try {
      cuerpo = (await respuesta.json()) as Partial<RespuestaError>;
    } catch {
      cuerpo = { mensaje: `El servidor respondió ${respuesta.status}.` };
    }
    throw new ErrorApi(respuesta.status, cuerpo);
  }

  if (opciones.comoArchivo === true) {
    return (await respuesta.blob()) as unknown as T;
  }
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export const api = {
  obtener: <T>(ruta: string) => peticion<T>(ruta),
  crear: <T>(ruta: string, cuerpo: unknown) => peticion<T>(ruta, { metodo: 'POST', cuerpo }),
  modificar: <T>(ruta: string, cuerpo: unknown) => peticion<T>(ruta, { metodo: 'PATCH', cuerpo }),
  eliminar: <T>(ruta: string) => peticion<T>(ruta, { metodo: 'DELETE' }),
  subir: <T>(ruta: string, formulario: FormData) =>
    peticion<T>(ruta, { metodo: 'POST', formulario }),
  descargar: (ruta: string) => peticion<Blob>(ruta, { comoArchivo: true }),
};

/** R4 — lo único que la pantalla de ingreso puede decir. */
export const MENSAJE_INGRESO_FALLIDO = MENSAJE_CREDENCIALES_INVALIDAS;

/**
 * Provoca la descarga de un `Blob` en el navegador.
 *
 * Se hace con un enlace temporal y `URL.createObjectURL` porque el archivo lo
 * genera el servidor con el testigo de sesión en una cabecera: un `<a href>`
 * directo no la llevaría y recibiría un 401.
 */
export function descargarArchivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
