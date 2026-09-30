"""
Configuración de PAID SIGIT Versión 2026.

Toda la configuración sensible llega por variables de entorno. Nada de claves
en el repositorio: el área de tecnología de la Armada escanea el código, y una
clave en un archivo versionado es un hallazgo aunque sea «de desarrollo».

Si falta algo imprescindible en producción, el proceso no arranca: es mejor
fallar al desplegar que a la tercera petición.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

NOMBRE_PLATAFORMA = "PAID SIGIT"
VERSION_PLATAFORMA = "Versión 2026"


def _entorno(nombre: str, por_omision: str | None = None) -> str:
    valor = os.environ.get(nombre, por_omision)
    if valor is None:
        raise ImproperlyConfigured(f"Falta la variable de entorno {nombre}.")
    return valor


def _booleano(nombre: str, por_omision: bool) -> bool:
    return os.environ.get(nombre, str(por_omision)).strip().lower() in {"1", "true", "si", "sí"}


DEBUG = _booleano("SIGIT_DEBUG", False)
# Bajo pytest se activa solo: la batería corre sin variables de entorno a mano.
PRUEBAS = _booleano("SIGIT_PRUEBAS", False) or "pytest" in sys.modules
# Despliegue de DEMOSTRACIÓN en línea: permite sembrar datos de EJEMPLO sin
# SIGIT_DEBUG y muestra en cada pantalla que los datos no son oficiales.
DEMOSTRACION = _booleano("SIGIT_DEMOSTRACION", False)

# En desarrollo se admite una clave local conocida; en producción, no.
if DEBUG or PRUEBAS:
    SECRET_KEY = os.environ.get("SIGIT_CLAVE_SECRETA", "solo-desarrollo-no-usar-en-produccion")
else:
    SECRET_KEY = _entorno("SIGIT_CLAVE_SECRETA")
    if len(SECRET_KEY) < 50:
        raise ImproperlyConfigured("SIGIT_CLAVE_SECRETA debe tener al menos 50 caracteres.")

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("SIGIT_HOSTS", "localhost,127.0.0.1").split(",")]
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("SIGIT_ORIGENES_CONFIABLES", "").split(",") if o.strip()
]
# Render publica el nombre que asignó al servicio; se admite ese y solo ese,
# en vez de todo *.onrender.com.
if _RENDER := os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(_RENDER)
    CSRF_TRUSTED_ORIGINS.append(f"https://{_RENDER}")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "django.contrib.postgres",
    "rest_framework",
    "drf_spectacular",
    "sigit.nucleo",
    "sigit.maestros",
    "sigit.jornadas",
    "sigit.integracion",
    "sigit.analitica",
    "sigit.api",
    "sigit.proteccion",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "sigit.nucleo.middleware.CabecerasSeguridadMiddleware",
    # Tiene que ir DESPUÉS de la autenticación: fija el contexto de la base de
    # datos (unidad y usuario) con el usuario ya conocido. Ver D-S03.
    "sigit.nucleo.middleware.ContextoBaseDatosMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "sigit.nucleo.contexto.plataforma",
            ],
        },
    },
]


def _base_de_datos(url: str) -> dict[str, object]:
    partes = urlparse(url)
    if partes.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL debe ser postgres://")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": partes.path.lstrip("/"),
        "USER": unquote(partes.username or ""),
        "PASSWORD": unquote(partes.password or ""),
        "HOST": partes.hostname or "127.0.0.1",
        "PORT": str(partes.port or 5432),
        # Cada petición corre en UNA transacción: el contexto de RLS se fija
        # con set_config(..., true), que solo vive dentro de ella. Ver D-S03.
        "ATOMIC_REQUESTS": False,
        "CONN_MAX_AGE": int(os.environ.get("SIGIT_CONEXION_SEGUNDOS", "60")),
        "CONN_HEALTH_CHECKS": True,
        "TEST": {"NAME": "prueba_paid_sigit"},
    }


DATABASES = {
    "default": _base_de_datos(
        _entorno(
            "DATABASE_URL",
            "postgres://sigit_propietario:propietario_local@127.0.0.1:5432/paid_sigit"
            if (DEBUG or PRUEBAS)
            else None,
        )
    )
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "nucleo.Usuario"
LOGIN_URL = "nucleo:ingreso"
LOGIN_REDIRECT_URL = "analitica:tablero"
LOGOUT_REDIRECT_URL = "nucleo:ingreso"

# Argon2id primero: es el algoritmo que recomienda OWASP para claves.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Sesión: 10 minutos de inactividad, deslizante, evaluada en el servidor ──
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_AGE = int(os.environ.get("SIGIT_SESION_SEGUNDOS", "600"))
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
SESSION_COOKIE_NAME = "sigit_sesion"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_NAME = "sigit_csrf"

HTTPS = _booleano("SIGIT_HTTPS", not DEBUG and not PRUEBAS)
SESSION_COOKIE_SECURE = HTTPS
CSRF_COOKIE_SECURE = HTTPS
SECURE_SSL_REDIRECT = HTTPS and _booleano("SIGIT_REDIRIGIR_HTTPS", True)
# La sonda de salud del orquestador llega por http interno, sin el encabezado
# del proxy: redirigirla la daría por caída.
SECURE_REDIRECT_EXEMPT = [r"^salud/$"]
SECURE_HSTS_SECONDS = 31536000 if HTTPS else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = HTTPS
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
# La inclusión en la lista de precarga HSTS de los navegadores la decide el
# dueño del dominio (p. ej., armada.mil.co para todos sus subdominios), no esta
# aplicación: es difícil de revertir. Por eso no se activa aquí.
SILENCED_SYSTEM_CHECKS = ["security.W021"]
# Detrás de un proxy que termina TLS (nginx), la petición llega por http.
if _booleano("SIGIT_DETRAS_DE_PROXY", False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Cuántos proxies de confianza hay delante: decide qué entrada de
# X-Forwarded-For es la IP real del cliente (ver nucleo/red.py).
PROXIES_DE_CONFIANZA = int(os.environ.get("SIGIT_PROXIES_DE_CONFIANZA", "0"))

# ── Ingreso ─────────────────────────────────────────────────────────────────
INTENTOS_ANTES_DE_BLOQUEO = 5
MINUTOS_DE_BLOQUEO = 15
MINUTOS_VIGENCIA_CAPTCHA = 5

LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True  # Instantes en UTC en la base; se presentan en America/Bogota.
USE_THOUSAND_SEPARATOR = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "estaticos_recolectados"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if (DEBUG or PRUEBAS)
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}

# Los soportes NO se sirven como estáticos: pasan por una vista que comprueba
# que el usuario puede ver la jornada (RLS). Ver jornadas/vistas_adjuntos.py.
MEDIA_ROOT = Path(os.environ.get("SIGIT_RUTA_ADJUNTOS", BASE_DIR / "adjuntos"))
CUOTA_ADJUNTOS_BYTES = 10 * 1024 * 1024  # 10 MB AGREGADOS por jornada.
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 2000

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "sigit.integracion.autenticacion.TestigoSistemaExterno",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ["sigit.api.limites.LimitePorSistema"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 100,
    "EXCEPTION_HANDLER": "sigit.api.errores.manejar_error",
}
SPECTACULAR_SETTINGS = {
    "TITLE": "PAID SIGIT — API de interoperabilidad",
    "DESCRIPTION": (
        "API de PAID SIGIT Versión 2026 para que otros sistemas de información de la "
        "Armada consulten datos maestros y para que SIGIT entregue actividades a la "
        "bandeja de revisión de JACID."
    ),
    "VERSION": "2026.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {"consola": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["consola"], "level": os.environ.get("SIGIT_NIVEL_REGISTRO", "INFO")},
    "loggers": {
        "django.security": {"handlers": ["consola"], "level": "WARNING", "propagate": False},
    },
}
