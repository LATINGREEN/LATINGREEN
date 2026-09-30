# Seguridad — PAID SIGIT Versión 2026

Resumen de los controles, para el escaneo y la revisión del área de tecnología
de la Armada. Cada control tiene una prueba o una comprobación automática que
falla si se rompe: `./scripts/verificar.sh`.

## Autenticación y sesión

| Control | Detalle | Prueba |
|---|---|---|
| Credencial por unidad `SIGLA_PAID` | Formato impuesto por validador | — |
| Claves con Argon2id | `PASSWORD_HASHERS`; mínimo 12 caracteres y validadores de Django | — |
| Captcha de un solo uso | Se guarda el HMAC de la respuesta, no la respuesta; caduca a los 5 min | `test_captcha_de_un_solo_uso` |
| Bloqueo por intentos | 5 claves erradas → 15 min bloqueado | `test_bloqueo_tras_cinco_intentos` |
| Un solo mensaje de error | «Credenciales inválidas» para toda causa; la causa real queda en `nucleo_intentoingreso` | `test_toda_falla_dice_lo_mismo_y_la_base_distingue` |
| Sin enumeración por tiempo | La clave se verifica también cuando la credencial no existe | `test_la_clave_se_verifica_aunque_la_credencial_no_exista` |
| Sesión de 10 minutos deslizantes | Evaluada en el servidor; aviso a los 8 minutos con opción de renovar | `test_la_sesion_dura_diez_minutos_deslizantes` |
| Cookies | `HttpOnly`, `SameSite=Strict`, `Secure` con HTTPS | `check --deploy` |

## Autorización y aislamiento

- **Roles:** CONSULTA, OPERADOR, REVISOR_JACID, ADMINISTRADOR (grupos de Django).
- **Row Level Security forzada** en PostgreSQL: una unidad no ve ni escribe
  datos fuera de su rama de la jerarquía, aunque la vista lo intente. Las
  políticas fallan cerradas sin contexto. Ver `docs/ARQUITECTURA.md`.
- **Dos roles de base de datos:** el dueño (migraciones) y el de la aplicación,
  `NOSUPERUSER NOBYPASSRLS`, sin `DELETE` en tablas de borrado lógico, sin
  escritura sobre la bitácora ni `TRUNCATE`.
- **Sistemas externos:** testigo por sistema, del que solo se guarda el
  resumen SHA-256; alcance ENTREGA o LECTURA; límite de 600 peticiones/hora.
  Pruebas en `pruebas/test_integracion.py`.

## Protección de la aplicación web

| Riesgo | Control |
|---|---|
| XSS | Autoescape de plantillas; CSP `script-src 'self'` sin `unsafe-inline` ni `unsafe-eval`; htmx con `allowEval: false` y `selfRequestsOnly` |
| CSRF | Middleware de Django; htmx envía el testigo en cabecera |
| Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'` |
| Inyección SQL | ORM y parámetros; el único SQL construido (migraciones) usa constantes y un nombre de rol validado |
| Carga de archivos | Tipo decidido por el contenido (firma), extensiones permitidas, cuota de 10 MB por jornada, nombre aleatorio fuera de los estáticos, descarga por vista con RLS y `nosniff` |
| Inyección de fórmulas en Excel/CSV | Celdas que empiezan por `= + - @` se escapan (`test_la_exportacion_escapa_formulas`) |
| IP falsificada en `X-Forwarded-For` | Solo cuenta la entrada del proxy de confianza (`SIGIT_PROXIES_DE_CONFIANZA`) |
| Transporte | HSTS de un año con HTTPS; redirección a HTTPS; la precarga HSTS queda a decisión del dueño del dominio |
| Dependencias externas en tiempo de ejecución | Ninguna: fuentes, gráficas y scripts se sirven desde el despliegue |

## Registro y trazabilidad

- **Bitácora** de todo INSERT/UPDATE/DELETE en las tablas del dominio, con el
  antes, el después y el usuario, alimentada por disparador.
- **Auditoría de fila** (`creado_por`, `modificado_por`) llenada por disparador.
- **Intentos de ingreso** con causa, IP y agente.
- **Borrado lógico**: una jornada retirada sale de listados y consolidados,
  no de la base.
- Errores de la API con `id_correlacion` para cruzar con el registro del
  servidor sin exponer trazas.

## Verificación automática (`scripts/verificar.sh`)

1. `ruff` (incluye reglas de seguridad `S`) y formato.
2. `bandit`.
3. Migraciones al día; diccionario de datos al día.
4. `manage.py check --deploy` con valores de producción, sin advertencias.
5. `pytest` contra una base **nueva** (68 pruebas, cobertura mínima 80 %).
6. `pip-audit`: dependencias sin vulnerabilidades conocidas.
7. Licencias sin GPL/AGPL.

## Pendiente

- Contrastar con los **lineamientos de desarrollo seguro de la Armada** cuando
  el área de tecnología los envíe.
- Correr el **escaneo institucional** (y el agente de IA de análisis de
  seguridad que mencionó el área) sobre este código y sobre el despliegue.
- Revisión por pares del código antes de producción.
