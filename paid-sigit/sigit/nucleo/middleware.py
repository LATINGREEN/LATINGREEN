from __future__ import annotations

from collections.abc import Callable

from django.db import transaction
from django.http import HttpRequest, HttpResponse

from .contexto_bd import establecer_contexto

# Sin orígenes externos: fuentes, gráficas y scripts se sirven desde el propio
# despliegue. En internet, además, es la primera defensa contra un script
# inyectado. Los datos de las gráficas viajan en <script type="application/json">,
# que no se ejecuta, así que no hace falta 'unsafe-inline' para scripts.
POLITICA_CONTENIDO = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
)


class CabecerasSeguridadMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        respuesta = self.get_response(request)
        respuesta.headers.setdefault("Content-Security-Policy", POLITICA_CONTENIDO)
        respuesta.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"
        )
        return respuesta


class ContextoBaseDatosMiddleware:
    """
    Cada petición autenticada corre en UNA transacción cuya primera sentencia
    fija el contexto de RLS. Las plantillas (TemplateResponse) se evalúan
    dentro de `get_response`, así que las consultas perezosas que ejecutan
    también ven el contexto correcto.

    Django convierte las excepciones de la vista en respuestas 500 ANTES de
    que lleguen aquí, así que el `atomic` no las vería: por eso se marca la
    reversión a mano cuando la respuesta es un error del servidor. Sin esto,
    una vista que falla a mitad de camino dejaría escrita la primera mitad.

    Las peticiones de la API con testigo de sistema externo no traen usuario
    de sesión; su contexto lo fija la clase de autenticación, dentro de esta
    misma transacción.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        with transaction.atomic():
            usuario = getattr(request, "user", None)
            if usuario is not None and usuario.is_authenticated:
                establecer_contexto(usuario.unidad.ruta, usuario.pk)
            else:
                # Explícito, aunque la transacción sea nueva: sin usuario no se
                # ve nada, pase lo que pase antes en la conexión.
                establecer_contexto("", None)
            respuesta = self.get_response(request)
            if respuesta.status_code >= 500:
                transaction.set_rollback(True)
            return respuesta
