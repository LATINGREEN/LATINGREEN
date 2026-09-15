# Migraciones

⛔ **Vacio a proposito.**

La Fase 1 traduce `anexo_A_ddl_paid.sql` a migraciones de Drizzle. Ese archivo
no esta disponible todavia y PROMPT.md prohibe improvisar el esquema:

> Si falta el `.sql`, **detente y pídelo**. No improvises el esquema.

Cuando llegue:

1. Colocarlo en `paid/anexo_A_ddl_paid.sql`.
2. Traducirlo a `packages/db/src/esquema/*.ts`, **completando** lo que no
   cubre: los 26 catalogos de `ref`, las once tablas hijas, `doc`, `aud` y los
   cuatro subtipos restantes.
3. `pnpm db:generate` produce el `up` en `migraciones/`.
4. Escribir a mano el `down` correspondiente en `migraciones/bajada/`, con el
   mismo nombre de archivo.
5. La Puerta 1 comprueba que **cada migracion aplica y revierte limpiamente**.

## Convencion de nombres

```
migraciones/0001_extensiones_y_esquemas.sql
migraciones/bajada/0001_extensiones_y_esquemas.sql
```

Una migracion sin su `down` no se da por terminada (A.1: «migraciones
versionadas y reversibles»).
