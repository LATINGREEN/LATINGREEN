# PAID SIGIT Versión 2026 — reglas del proyecto

Django 5.2 + PostgreSQL 16. Proyecto hermano de `../paid/` (TypeScript), del
que hereda reglas, no código. Antes de tocar algo, lea `docs/DECISIONES.md`.

## Invariantes
- Aislamiento por unidad con **RLS forzada** en PostgreSQL, nunca solo con
  filtros en la vista. Toda tabla nueva con datos de unidad: política RLS y
  disparador de bitácora en una **nueva** migración de `sigit/proteccion`.
- El contexto se fija con `set_config(…, true)` dentro de una transacción
  (`nucleo/contexto_bd.py`). Nunca `SET` ni `is_local = false`: filtra datos
  entre peticiones que comparten conexión.
- Las políticas fallan cerradas. Órdenes de administración: `contexto_de_sistema()`.
- Ningún valor por omisión «plausible» en un dato del consolidado (fechas,
  coordenadas, sí/no). Quien no elige, no guarda.
- La ARC participa siempre (CHECK). Borrado lógico. Soportes: 10 MB agregados
  por jornada, tipo por contenido.
- Nada de SIGIT entra sin aprobación de JACID.
- CSP estricta: sin scripts ni estilos en línea, sin CDN. Datos a JavaScript
  por `json_script`.
- No inventar catálogos, indicadores ni el algoritmo del código de actividad:
  TODO(JACID).

## Comandos
- `SIGIT_DEBUG=1 .venv/bin/python manage.py runserver`
- `./scripts/verificar.sh` (todo) · `.venv/bin/pytest` (pruebas)
- `python manage.py diccionario_datos > docs/DICCIONARIO-DATOS.md` tras cambiar modelos

## Trampas conocidas
- `IntentoIngreso` y `Bitacora` se ordenan del más reciente al más antiguo:
  `.last()` devuelve el más viejo.
- En las pruebas, una petición del cliente cambia el contexto de RLS de la
  transacción de la prueba: llame `sistema()` (conftest) antes de consultar.
- Una base de pruebas reutilizada esconde errores de migración: tras tocar
  migraciones, `pytest --create-db`.
- Un comentario dentro de un SQL de migración rompe la migración: los
  `# nosec` van en la línea de Python, nunca dentro de la cadena.

## Convenciones
Español sin tildes en identificadores, `snake_case`; comentarios que explican
por qué; versiones exactas; commits pequeños en español.
