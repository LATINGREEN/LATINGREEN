# Teselas del mapa

MapLibre sin teselas no dibuja nada, y no puede traerlas de internet
(PROMPT.md A.2.3).

Dos caminos, y la decisión es de JACID — ver `docs/PREGUNTAS-JACID.md`, **Q11**:

1. **Servicio cartográfico institucional.** Si la ARC tiene un WMS/WMTS, se
   consume ese y este directorio queda vacío. Es el camino preferible: nada que
   empaquetar, nada que mantener actualizado.
2. **PMTiles propio.** Un único archivo con el extracto de Colombia, colocado
   aquí como `colombia.pmtiles` y servido por el propio backend. El archivo es
   grande, así que está excluido en `.gitignore` y se distribuye aparte
   (medio físico o repositorio de artefactos de la Intranet).

Hasta que Q11 se responda, el botón «Ver ubicación» de la Fase 4 debe degradar
con un aviso claro («cartografía no disponible en este despliegue») y seguir
mostrando las coordenadas en GMS y decimales. Un mapa en blanco sin explicación
es peor que no tener mapa.
