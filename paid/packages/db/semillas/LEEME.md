# Semillas

`pnpm db:seed`. Idempotentes: `ON CONFLICT DO NOTHING` en todo.

## Qué se siembra y qué no

Se siembra **lo que PROMPT.md enumera de forma literal**: los 7 COAMI, las 4
categorías de adjunto con sus 16 extensiones, las 8 causas de intento de
autenticación, los 8 tramos de avance, los 3 niveles de jerarquía, los 33
departamentos DANE, los grados y escalafones. Y lo que el **Manual del
Usuario PAID** enumera literalmente: los 3 tipos de jornada (lámina 20), los
11 tipos de herramienta AID y sus 2 estados (lámina 46).

**No se siembra nada más.** La regla de PROMPT.md es explícita: «Los catálogos
que dependen de JACID se siembran vacíos con un TODO, no inventados.»

Quedan vacíos, cada uno con su pregunta en `docs/PREGUNTAS-JACID.md`:

| Catálogo | Por qué está vacío |
|---|---|
| `ref.municipio` | DIVIPOLA son 1100+ filas; se cargan del archivo del DANE |
| `ref.campana_institucional` | Q2: las 17 campañas no constan |
| `ref.atributo_herramienta_aid` | Q3 |
| `ref.tipo_operacion` | Q4 |
| `ref.servicio_prestado` | Q4 |
| `ref.grupo_poblacional` | Q4 y Q10 |
| `ref.medio_difusion` | no enumerado en PROMPT.md |
| `ref.medio_utilizado` | no enumerado en PROMPT.md |
| `ref.tipo_recurso` | no enumerado en PROMPT.md |
| `ref.tipo_bien_donado` | no enumerado en PROMPT.md |

**Consecuencia buscada:** hasta que JACID responda, ninguna actividad puede
alcanzar `registro_completo = TRUE`, porque varias pestañas no tienen catálogo
con el que llenarse. Eso es correcto. Lo incorrecto sería dejar cerrar
registros contra categorías inventadas: entonces el RAO cuadraría y estaría
mal.

## Cargar DIVIPOLA cuando se tenga el archivo

El DANE publica la división político-administrativa como hoja de cálculo. El
municipio se cuelga de su departamento por el código, y la base lo verifica
sola: los dos primeros dígitos del código de municipio son el del
departamento, y hay una clave foránea sobre esa derivación. Un municipio en el
departamento equivocado no entra.

```sql
-- Con el CSV ya normalizado a (codigo_dane, nombre):
\copy municipio_bruto (codigo_dane, nombre) FROM 'divipola.csv' CSV HEADER

INSERT INTO ref.municipio (id_departamento, codigo_dane, nombre)
SELECT d.id, b.codigo_dane, b.nombre
  FROM municipio_bruto b
  JOIN ref.departamento d ON d.codigo_dane = substring(b.codigo_dane FROM 1 FOR 2)
ON CONFLICT (codigo_dane) DO NOTHING;
```

## Datos de desarrollo

`0003_desarrollo.sql` siembra unidades y usuarios de ejemplo **solo** cuando
`PAID_SEMILLA_DESARROLLO=1`. Nunca en producción: las claves son conocidas.

## Red autorizada

`0004_red_abierta.sql` siembra `0.0.0.0/0` y `::/0` en todo entorno: el
ingreso procede desde cualquier dirección, que es lo que pide un despliegue en
internet (D-38). Para cerrar la red, registre los rangos propios en
`seg.red_autorizada` y desactive esos dos. El arranque de la API dice en una
línea cuál de las dos situaciones está en vigor.
