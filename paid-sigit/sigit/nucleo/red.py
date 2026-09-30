"""
La IP de origen real de una petición que llega a través de proxies.

Cada proxy AÑADE al final de X-Forwarded-For la dirección desde la que le llegó
la petición. Lo que viene antes lo escribió el cliente y puede ser falso. Por
eso se toma la entrada que añadió el proxy de confianza más externo, contando
desde el final, y no la primera. Lección de la PAID (D-38).
"""

from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest


def ip_de_origen(request: HttpRequest) -> str | None:
    proxies: int = settings.PROXIES_DE_CONFIANZA
    socket = request.META.get("REMOTE_ADDR")
    if proxies <= 0:
        return socket
    entradas = [
        e.strip() for e in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",") if e.strip()
    ]
    if not entradas:
        return socket
    return entradas[max(0, len(entradas) - proxies)]
