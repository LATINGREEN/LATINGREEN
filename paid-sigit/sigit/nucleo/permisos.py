from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse

from .models import Rol, Unidad


def requiere_rol(
    *roles: str,
) -> Callable[[Callable[..., HttpResponse]], Callable[..., HttpResponse]]:
    """Exige sesión y alguno de los roles. Sin roles, basta con cualquier rol."""
    exigidos = roles or Rol.TODOS

    def decorador(vista: Callable[..., HttpResponse]) -> Callable[..., HttpResponse]:
        @login_required
        @wraps(vista)
        def envoltura(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
            if not request.user.tiene_rol(*exigidos):
                raise PermissionDenied
            return vista(request, *args, **kwargs)

        return envoltura

    return decorador


def unidades_de(usuario: Any) -> Any:
    """La unidad del usuario y sus subordinadas: donde puede registrar."""
    return Unidad.objects.filter(ruta__startswith=usuario.unidad.ruta, activa=True).order_by("ruta")


REGISTRAR = (Rol.OPERADOR, Rol.ADMINISTRADOR)
REVISAR = (Rol.REVISOR_JACID, Rol.ADMINISTRADOR)
