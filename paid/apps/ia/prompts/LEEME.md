# Plantillas de prompt

**Nunca un prompt escrito en el código** (PROMPT.md B.6, Fase 7, punto 2).

Las plantillas viven aquí, versionadas, con su número de versión en el nombre:

```
extraccion.v1.md
coherencia.v1.md
resumen.v1.md
```

`ia.sugerencia` registra qué plantilla y qué versión produjo cada propuesta
(IA5), y un cambio de plantilla —igual que un cambio de modelo— **exige
reejecutar el conjunto de evaluación** de B.7 antes de desplegar. Un cambio sin
reevaluar es un despliegue a ciegas.

## Pendiente

`extraccion.v1.md` necesita **ejemplos reales de clavegrama anonimizados**. No
se inventan: un ejemplo inventado enseña al modelo un formato que no es el que
recibirá. Ver `docs/PREGUNTAS-JACID.md`, Q4 (formularios reales de las pestañas)
y B.7 punto 1 (las 50–100 jornadas ya registradas a mano que sirven de conjunto
de referencia).
