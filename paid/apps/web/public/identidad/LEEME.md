# Identidad institucional

La interfaz toma de aquí los emblemas, y la paleta vive en
`src/estilos/tokens.css`. Todo se sirve desde el propio despliegue (A.2.1): no
se enlaza a `armada.mil.co` ni a ningún otro origen.

## Qué hay

| Archivo | Qué es | De dónde salió |
|---|---|---|
| `escudo-armada.webp` | Escudo de la Armada de Colombia (ancla con el escudo). | Imagen entregada por el usuario el 2026-09-23. Se recortó la parte del ancla y el escudo —la palabra «ARMADA DE COLOMBIA» venía cortada por abajo— y se quitó el fondo blanco solo donde tocaba el borde, para no perder el blanco interior del escudo. El nombre de la entidad se escribe en texto al lado (Ley 2345 de 2023: logotipo con el nombre de la entidad). |
| `emblema-jacid.webp` | Emblema de la Jefatura de Acción Integral y Desarrollo. | Imagen entregada por el usuario el 2026-09-23, recortada en círculo sobre su borde dorado. |

Ambas son de baja resolución (unos 250 px de lado). Alcanzan para como se usan
—cabecera, ingreso, la lámina de Inicio—, pero **si la JACID tiene los
originales en vector (SVG o PDF), conviene reemplazarlos**: se ganaría nitidez en
pantallas de alta densidad sin cambiar código, con el mismo nombre de archivo.

## La paleta

Del Manual de Identidad Visual de la ARC, entregada por el usuario:

| Tono | HEX | Uso en la interfaz |
|---|---|---|
| Azul Armada (primario) · Pantone 281 C | `#00205B` | Cabecera, texto principal, botones primarios |
| Dorado Naval (primario) | `#D4AF37` | Línea bajo la cabecera, realces, recuadro de exportación. **Nunca texto sobre blanco**: da 2,1:1 y WCAG exige 4,5:1 |
| Rojo Bandera (secundario) · Pantone 186 C | `#C8102E` | Alertas, «incompleto», cerrar sesión |
| Blanco Naval (base) | `#FFFFFF` | Fondos |
| Gris Técnico (soporte) · Cool Gray 7 C | `#97999B` | Líneas divisorias. **Nunca texto ni borde de campo**: da 2,8:1 |

✅ **El dorado es `#D4AF37`**, confirmado el 2026-09-23. La tabla también
nombraba Pantone 123 C, que es un amarillo (≈ `#FFC72C`); no se usa. En impresos,
el equivalente del dorado metálico es Pantone 871 C.

## Lo que falta

- El **escudo de la República** del recuadro «Ministerio de Defensa Nacional» y
  los logos **GOV.CO** y **CO Colombia** del pie: el manual del usuario los
  muestra, pero no se entregaron. Se escriben en texto.
- El **emblema redondo** que el manual del usuario muestra a la izquierda de
  «PAID» en la cabecera.
