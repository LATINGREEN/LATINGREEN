import { readdirSync } from 'node:fs';

/**
 * Que archivos de `semillas/` hay que ejecutar.
 *
 * Existe en un solo sitio a proposito. La regla —«los archivos de desarrollo
 * no corren salvo peticion expresa»— la necesitan `pnpm db:seed` y los dos
 * arranques de pruebas, y duplicarla en tres sitios es garantizar que uno se
 * quede atras. Ya paso: el arranque de la Puerta 1 empezo a sembrar los datos
 * de desarrollo y choco con sus propias unidades de prueba.
 *
 * Los archivos de desarrollo contienen credenciales con clave conocida: en
 * un despliegue expuesto a internet, eso es una puerta abierta.
 */
export function archivosDeSemillas(
  directorio: string,
  incluirDesarrollo: boolean,
): string[] {
  return readdirSync(directorio)
    .filter((nombre) => nombre.endsWith('.sql'))
    .filter((nombre) => incluirDesarrollo || !esDeDesarrollo(nombre))
    .sort();
}

export function esDeDesarrollo(nombreArchivo: string): boolean {
  return nombreArchivo.includes('desarrollo');
}

/** `PAID_SEMILLA_DESARROLLO=1` es la peticion expresa. */
export function seIncluyeDesarrollo(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return entorno['PAID_SEMILLA_DESARROLLO'] === '1';
}
