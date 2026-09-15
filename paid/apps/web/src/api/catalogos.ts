import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { CatalogoExpuesto, OpcionCatalogo } from '@paid/schema';
import { api } from './cliente';

/**
 * Lectura de un catálogo cerrado de `ref`.
 *
 * La interfaz NUNCA lleva su propia copia de un dominio cerrado: el anexo lo
 * prohíbe («dominios cerrados en tablas de catálogo de `ref`, nunca VARCHAR
 * libre»), y una copia en el cliente se desactualiza sin avisar y empieza a
 * ofrecer valores que la base rechaza. El usuario vería «Datos inválidos»
 * sobre una opción que el propio sistema le ofreció.
 *
 * `staleTime` largo porque los catálogos cambian con una migración, no durante
 * una sesión. En una red cerrada, además, cada petición evitada cuenta.
 */
export function useCatalogo(
  nombre: CatalogoExpuesto,
  idDepartamento?: number,
): UseQueryResult<readonly OpcionCatalogo[]> {
  const filtra = nombre === 'municipio' && idDepartamento !== undefined;
  return useQuery({
    queryKey: ['catalogo', nombre, idDepartamento ?? null],
    queryFn: () =>
      api.obtener<readonly OpcionCatalogo[]>(
        filtra ? `/catalogos/${nombre}?idDepartamento=${String(idDepartamento)}` : `/catalogos/${nombre}`,
      ),
    staleTime: 15 * 60 * 1000,
    // Los municipios solo se piden cuando hay departamento: son ~1100 y un
    // desplegable con mil opciones no es un dominio usable.
    enabled: nombre !== 'municipio' || idDepartamento !== undefined,
  });
}
