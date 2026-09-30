"""
Límite de peticiones por sistema externo o por usuario, no por IP (varios
sistemas pueden salir por el mismo proxy). Vive aparte de las vistas porque
DRF lo importa al cargar su configuración, antes que a las vistas.
"""

from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle

from sigit.integracion.autenticacion import IdentidadSistema
from sigit.integracion.models import SistemaExterno


def sistema_de(request: Request) -> SistemaExterno | None:
    return request.user.sistema if isinstance(request.user, IdentidadSistema) else None


class LimitePorSistema(SimpleRateThrottle):
    rate = "600/hour"

    def get_cache_key(self, request: Request, view: Any) -> str | None:
        sistema = sistema_de(request)
        identidad = (
            f"sistema-{sistema.pk}" if sistema else f"usuario-{getattr(request.user, 'pk', None)}"
        )
        return f"sigit-api-{identidad}"
