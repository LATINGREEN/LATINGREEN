# Identidad institucional — dónde va el material oficial

Esta carpeta es el **único** sitio donde la interfaz busca la identidad visual
de la institución. Nada de aquí está programado: se deja el archivo y la
interfaz lo toma. Está vacía de material oficial **a propósito**.

## Por qué está vacía

1. **No se pudo obtener de la fuente oficial.** El Manual de Identidad Visual de
   la Armada está publicado en `armada.mil.co`, pero la red desde la que se
   construyó esta interfaz lo bloquea, igual que `funcionpublica.gov.co` y el
   repositorio de símbolos patrios de Wikimedia.
2. **No se tomó de fuentes no oficiales.** Hay sitios que ofrecen «el logo de la
   Armada» en vector. Una reproducción de terceros de un emblema militar puede
   estar desactualizada o mal trazada, y un símbolo institucional equivocado en
   un sistema institucional es peor que ninguno.
3. **No se dibujó de memoria.** Por la misma razón.

## Qué exige la norma

La **Ley 2345 de 2023** («Chao marcas») aplica a las Fuerzas Militares: las
entidades del orden nacional usan como logotipo el **Escudo de la República de
Colombia** acompañado del **nombre de la entidad**, y solo pueden complementarlo
con el nombre de la dependencia. El artículo 4, literal g, prevé excepciones;
si la Armada usa su propio emblema, será porque su Manual de Identidad Visual lo
fija. **Ese manual manda sobre todo lo de esta carpeta.**

## Qué archivos poner

| Archivo | Qué es | Si falta |
|---|---|---|
| `escudo.svg` | El logotipo institucional que fije el Manual de Identidad Visual de la ARC (Escudo de la República, o el emblema que el manual autorice). SVG, fondo transparente. | Se muestra el ancla de la interfaz |
| `marca.css` | La paleta institucional, como variables CSS. Hay una plantilla abajo. | Se usa la paleta «carta náutica» |

Los archivos se sirven desde el propio despliegue (A.2.1): **no** enlazar a
`armada.mil.co` ni a ningún otro origen.

## Plantilla de `marca.css`

Los nombres de las variables son los de `src/estilos/tokens.css`. Solo hace
falta declarar los que cambian.

```css
/*
 * Paleta institucional. Fuente: Manual de Identidad Visual ARC, página __.
 *
 * ⚠️ El selector excluye el modo de ALTO CONTRASTE a propósito. Ese modo existe
 * para quien no distingue matices, usa negro y blanco puros y no debe llevar
 * colores de marca: es accesibilidad, no identidad (WCAG 2.1 AA, Res. MinTIC
 * 1519 de 2020).
 */
:root:not([data-contraste='alto']) {
  --estela: #______;      /* acento principal: botones, enlaces, foco */
  --estela-honda: #______;
}

/* Si el manual es de fondo claro, conviene hacer del modo claro el habitual. */
:root[data-contraste='claro'] {
  --abismo: #______;      /* fondo de la página */
  --casco: #______;       /* tarjetas */
  --arena: #______;       /* texto */
}
```

**Antes de dar por buena una paleta**, correr la revisión de accesibilidad de la
Puerta 4: comprueba el contraste de 4,5:1 en los tres modos.

    pnpm --filter @paid/e2e test -- accesibilidad

Un color de marca que no llega a 4,5:1 sobre su fondo no puede ir en texto, por
oficial que sea.
