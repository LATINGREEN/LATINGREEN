# Esquema Drizzle

⛔ **Vacio a proposito.** Ver `../migraciones/README.md`.

Esquemas previstos (los que nombra PROMPT.md):

| Esquema | Contenido |
|---|---|
| `ref` | Los 26 catalogos de dominio cerrado (P9) |
| `org` | Fuerza, componente, unidad (`ruta_jerarquica ltree`), geografia DANE |
| `seg` | usuario, rol, permiso, rol_permiso, usuario_rol, sesion, intento_autenticacion, red_autorizada, captcha, solicitud_eliminacion |
| `ai`  | actividad (supertipo) + los seis subtipos + las once tablas hijas + entidad + herramienta_aid + personal |
| `doc` | normatividad y soportes documentales |
| `aud` | bitacora_cambio (solo insercion), exportacion |
| `ia`  | sugerencia, modelo (Parte B) |

Ninguno se escribe hasta tener el DDL de referencia.
