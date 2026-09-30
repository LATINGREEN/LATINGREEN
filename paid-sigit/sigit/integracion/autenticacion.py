"""
Autenticación de sistemas externos por testigo: `Authorization: Bearer sigit_…`.

Se busca por el RESUMEN del testigo, nunca por el testigo en claro. Al
autenticarse, se fija el contexto de RLS a la unidad del sistema, dentro de la
transacción de la petición (ver nucleo/middleware.py).
"""

from __future__ import annotations

from dataclasses import dataclass

from django.utils import timezone
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import authentication, exceptions
from rest_framework.request import Request

from sigit.nucleo.contexto_bd import establecer_contexto

from .models import SistemaExterno


@dataclass
class IdentidadSistema:
    """Hace de `request.user` para DRF cuando quien llama es un sistema."""

    sistema: SistemaExterno
    is_authenticated: bool = True
    is_anonymous: bool = False
    pk: None = None

    def __str__(self) -> str:
        return f"sistema:{self.sistema.codigo}"


class TestigoSistemaExterno(authentication.BaseAuthentication):
    palabra = "Bearer"

    def authenticate(self, request: Request) -> tuple[IdentidadSistema, SistemaExterno] | None:
        cabecera = authentication.get_authorization_header(request).decode("latin-1")
        if not cabecera:
            return None
        partes = cabecera.split()
        if len(partes) != 2 or partes[0] != self.palabra or not partes[1].startswith("sigit_"):
            raise exceptions.AuthenticationFailed("Testigo inválido.")
        sistema = (
            SistemaExterno.objects.select_related("unidad")
            .filter(resumen_testigo=SistemaExterno.resumir(partes[1]), activo=True)
            .first()
        )
        if sistema is None:
            raise exceptions.AuthenticationFailed("Testigo inválido.")
        SistemaExterno.objects.filter(pk=sistema.pk).update(ultimo_uso=timezone.now())
        establecer_contexto(sistema.unidad.ruta, None)
        return IdentidadSistema(sistema=sistema), sistema

    def authenticate_header(self, request: Request) -> str:
        return self.palabra


class EsquemaTestigo(OpenApiAuthenticationExtension):
    """Describe el testigo en el contrato OpenAPI, para quien integre."""

    target_class = "sigit.integracion.autenticacion.TestigoSistemaExterno"
    name = "TestigoSistema"

    def get_security_definition(self, auto_schema: object) -> dict[str, str]:
        return {
            "type": "http",
            "scheme": "bearer",
            "description": "Testigo por sistema externo, con la forma sigit_…",
        }
