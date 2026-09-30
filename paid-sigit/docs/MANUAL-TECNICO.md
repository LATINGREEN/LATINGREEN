# Manual técnico — PAID SIGIT Versión 2026

Para quien instala, opera o modifica la plataforma. La arquitectura está en
`ARQUITECTURA.md`; los controles de seguridad, en `SEGURIDAD.md`; el modelo de
datos, en `DICCIONARIO-DATOS.md`.

## 1. Requisitos

- Python 3.11 a 3.13 (la imagen usa 3.12) y [uv](https://docs.astral.sh/uv/).
- PostgreSQL 16 con la extensión `pg_trgm` (confiable: la crea el dueño de la
  base, sin superusuario).
- Para desplegar en contenedores: Docker y Docker Compose.

## 2. Desarrollo local

```bash
cd paid-sigit
uv sync                                    # entorno en .venv, versiones exactas de uv.lock

# Base y roles (una vez), como superusuario de PostgreSQL:
psql -U postgres <<'SQL'
CREATE ROLE sigit_propietario LOGIN PASSWORD 'propietario_local' NOSUPERUSER CREATEDB NOBYPASSRLS;
CREATE ROLE sigit_app LOGIN PASSWORD 'app_local' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE paid_sigit OWNER sigit_propietario;
GRANT CONNECT ON DATABASE paid_sigit TO sigit_app;
SQL

export SIGIT_DEBUG=1                       # clave y base locales por omisión
.venv/bin/python manage.py migrate
.venv/bin/python manage.py sembrar_demostracion   # datos de EJEMPLO; imprime credenciales
.venv/bin/python manage.py runserver
```

Abrir `http://127.0.0.1:8000`. Credenciales de la demostración (clave
`Desarrollo2026*`): `JACID_PAID` (revisor y administrador), `BIM23_PAID` y
`BIM24_PAID` (operadores), `FNP_PAID` (consulta).

`CREATEDB` en el rol dueño solo hace falta para que las pruebas creen su base;
en producción no se le da.

## 3. Verificación

```bash
./scripts/verificar.sh          # estilo, bandit, migraciones, diccionario,
                                # check --deploy, pruebas (base nueva), pip-audit, licencias
SIN_RED=1 ./scripts/verificar.sh  # igual, sin pip-audit (que consulta PyPI/OSV)
.venv/bin/pytest                # solo las pruebas (reutiliza la base de pruebas)
```

Las pruebas corren contra PostgreSQL real con RLS **forzada**. Si cambia una
migración, use `pytest --create-db` (el script ya lo hace): una base reutilizada
esconde errores de migración.

## 4. Despliegue con Docker

```bash
cp .env.example .env            # cambie TODAS las claves
docker compose up -d --build
```

- `db` (PostgreSQL 16): al crear el volumen, `docker/postgres-inicial.sh` crea
  el rol dueño y el de la aplicación. No publica puertos.
- `web` (gunicorn): al arrancar, migra y siembra los catálogos **con el rol
  dueño** (`DATABASE_URL_MIGRACIONES`) y atiende **con el rol de la aplicación**
  (`DATABASE_URL`), sin privilegios de dueño ni `BYPASSRLS`. Corre como usuario
  sin privilegios; sonda en `/salud/`.
- `nginx`: única puerta publicada (`SIGIT_PUERTO`, 8080 por omisión). Ponga el
  TLS aquí o en un proxy anterior; si hay otro proxy delante,
  `SIGIT_PROXIES_DE_CONFIANZA=2`.

Después del primer arranque:

```bash
docker compose exec web python manage.py createsuperuser   # o crear usuarios en /gestion/
docker compose exec web python manage.py cargar_divipola /ruta/divipola.csv
```

> ⚠️ La imagen **no se ha construido todavía en un entorno con Docker**: la
> sesión de desarrollo no tenía demonio de Docker. Sí se verificó la
> recolección de estáticos en modo producción, que es el paso de la
> construcción con más riesgo. Pruébese antes de la entrega.

## 5. Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `SIGIT_CLAVE_SECRETA` | sí (producción) | Clave de Django, ≥ 50 caracteres |
| `DATABASE_URL` | sí | `postgres://sigit_app:…@host:5432/paid_sigit` |
| `DATABASE_URL_MIGRACIONES` | en Docker | Rol dueño, solo para migrar |
| `SIGIT_HOSTS` | sí | Nombres de host permitidos, separados por comas |
| `SIGIT_ORIGENES_CONFIABLES` | con HTTPS | Orígenes para CSRF, p. ej. `https://paid-sigit.ejemplo.mil.co` |
| `SIGIT_HTTPS` | no (1) | Cookies seguras, HSTS y redirección a HTTPS |
| `SIGIT_DETRAS_DE_PROXY` | no | Confía en `X-Forwarded-Proto` del proxy |
| `SIGIT_PROXIES_DE_CONFIANZA` | no (0) | Cuántos proxies hay delante (para la IP real) |
| `SIGIT_ROL_APLICACION` | no (`sigit_app`) | Rol al que las migraciones dan privilegios |
| `SIGIT_RUTA_ADJUNTOS` | no | Carpeta de soportes (volumen en Docker) |
| `SIGIT_SESION_SEGUNDOS` | no (600) | Inactividad máxima de la sesión |
| `SIGIT_DEBUG` | no | Solo desarrollo. Nunca en producción |

## 6. Operación

- **Usuarios, unidades, catálogos, sistemas externos:** `/gestion/` (usuarios con
  «acceso a la gestión»). Los catálogos no se borran: se desactivan.
- **Emitir el testigo de SIGIT:** Gestión → Sistemas externos → crear (alcance
  ENTREGA). El testigo se muestra **una sola vez**; si se pierde, use la acción
  «Emitir un testigo nuevo» (invalida el anterior).
- **Catálogos de JACID pendientes** (tipos de operación, servicios, grupos
  poblacionales, medios, recursos, bienes): se cargan en Gestión. Sin ellos,
  las pestañas no tienen qué ofrecer.
- **Copias de seguridad:** `pg_dump` de `paid_sigit` y copia del volumen
  `adjuntos`. Restaurar las dos cosas juntas.
- **Bitácora:** Gestión → Bitácora de cambios (solo lectura).

## 7. Modificar el código

- Reglas de negocio en `servicios.py` de cada módulo; vistas delgadas.
- Toda tabla nueva con datos de unidad necesita su política RLS y su
  disparador de bitácora en una **nueva** migración de `sigit/proteccion`.
- Nada que cruce al navegador por fuera de `'self'`: sin CDN, sin estilos ni
  scripts en línea (la CSP lo bloquearía).
- Después de cambiar modelos: `makemigrations`, y regenerar
  `docs/DICCIONARIO-DATOS.md`. `verificar.sh` falla si se olvida.
- Versiones exactas en `pyproject.toml`; `uv lock` para actualizar `uv.lock`.
