from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest

from .models import Rol


def plataforma(request: HttpRequest) -> dict[str, object]:
    usuario = getattr(request, "user", None)
    roles: set[str] = set()
    if usuario is not None and usuario.is_authenticated:
        roles = set(usuario.groups.values_list("name", flat=True))
        if usuario.is_superuser:
            roles |= set(Rol.TODOS)
    pendientes = 0
    if roles & {Rol.REVISOR_JACID, Rol.ADMINISTRADOR}:
        from sigit.integracion.models import EstadoRevision, RegistroExterno

        pendientes = RegistroExterno.objects.filter(estado=EstadoRevision.PENDIENTE).count()
    return {
        "NOMBRE_PLATAFORMA": settings.NOMBRE_PLATAFORMA,
        "VERSION_PLATAFORMA": settings.VERSION_PLATAFORMA,
        "DEMOSTRACION": settings.DEMOSTRACION,
        "MINUTOS_SESION": settings.SESSION_COOKIE_AGE // 60,
        "roles_usuario": roles,
        "puede_registrar": bool(roles & {Rol.OPERADOR, Rol.ADMINISTRADOR}),
        "puede_revisar": bool(roles & {Rol.REVISOR_JACID, Rol.ADMINISTRADOR}),
        "pendientes_sigit": pendientes,
    }
