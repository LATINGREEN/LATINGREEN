# apps/ia — Asistencia por IA

Servicio FastAPI **aislado del resto del monorepo** (B.3). No está en el
workspace de pnpm: es Python.

## La regla que manda sobre todas

> La Parte A funciona completa **sin ningún componente de IA desplegado**
> (Puerta 5).

Si apagar este servicio degrada algo de la Parte A, eso es un defecto de la
Parte A, no una limitación de la IA.

## Levantar

```bash
cd apps/ia
python3.12 -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
uvicorn paid_ia.principal:app --reload --port 8000
```

`docker compose up ia` hace lo mismo dentro del contenedor.

## Estado

Fase 0: solo `/salud`. `/embeddings` llega en la Fase 6 y `/extraer` en la
Fase 7 — y la Fase 6 no empieza hasta que la Parte A cierre su Puerta 5.
