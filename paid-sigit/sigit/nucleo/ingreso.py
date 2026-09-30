"""
Ingreso: captcha de un solo uso, bloqueo por intentos y un único mensaje.

Todas las causas de rechazo se guardan en `IntentoIngreso` para el análisis
forense, pero la pantalla dice siempre «Credenciales inválidas». Y la clave se
verifica SIEMPRE, también cuando la credencial no existe, para que el tiempo de
respuesta no delate qué credenciales son válidas.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

from .models import Captcha, IntentoIngreso, ResultadoIngreso, Usuario

MENSAJE_CREDENCIALES_INVALIDAS = "Credenciales inválidas"

# Resumen de una clave que nadie tiene. Se verifica contra él cuando la
# credencial no existe, para gastar el mismo tiempo que con una real.
_RESUMEN_FICTICIO = make_password(secrets.token_urlsafe(24))


@dataclass(frozen=True)
class Reto:
    id_captcha: int
    texto: str


def _resumir(respuesta: str) -> str:
    # HMAC con la clave del sitio: el resumen guardado no sirve para adivinar
    # la respuesta con una tabla precalculada (hay solo unas decenas posibles).
    return hmac.new(
        settings.SECRET_KEY.encode(), respuesta.strip().encode(), hashlib.sha256
    ).hexdigest()


def emitir_reto() -> Reto:
    a = secrets.randbelow(9) + 1
    b = secrets.randbelow(9) + 1
    if secrets.randbelow(2):
        texto, respuesta = f"¿Cuánto es {a} + {b}?", a + b
    else:
        mayor, menor = max(a, b), min(a, b)
        texto, respuesta = f"¿Cuánto es {mayor} − {menor}?", mayor - menor
    captcha = Captcha.objects.create(resumen_respuesta=_resumir(str(respuesta)))
    return Reto(id_captcha=captcha.pk, texto=texto)


def _consumir_captcha(id_captcha: int | None, respuesta: str) -> bool:
    """Un solo uso: se marca consumido aunque la respuesta sea errada."""
    if id_captcha is None:
        return False
    vigente_desde = timezone.now() - timedelta(minutes=settings.MINUTOS_VIGENCIA_CAPTCHA)
    marcados = Captcha.objects.filter(
        pk=id_captcha, consumido_en__isnull=True, creado_en__gte=vigente_desde
    ).update(consumido_en=timezone.now())
    if marcados != 1:
        return False
    captcha = Captcha.objects.get(pk=id_captcha)
    return hmac.compare_digest(captcha.resumen_respuesta, _resumir(respuesta))


@dataclass(frozen=True)
class ResultadoAutenticacion:
    usuario: Usuario | None
    causa: str


@transaction.atomic
def autenticar(
    credencial: str,
    clave: str,
    id_captcha: int | None,
    respuesta_captcha: str,
    ip: str | None,
    agente: str,
) -> ResultadoAutenticacion:
    credencial = credencial.strip().upper()
    usuario = (
        Usuario.objects.select_for_update()
        .select_related("unidad")
        .filter(credencial=credencial)
        .first()
    )
    captcha_valido = _consumir_captcha(id_captcha, respuesta_captcha)
    # Se verifica SIEMPRE, exista o no la credencial.
    clave_valida = check_password(clave, usuario.password if usuario else _RESUMEN_FICTICIO)

    ahora = timezone.now()
    if not captcha_valido:
        causa = ResultadoIngreso.CAPTCHA_ERRADO
    elif usuario is None:
        causa = ResultadoIngreso.CREDENCIAL_INEXISTENTE
    elif usuario.bloqueado_hasta and usuario.bloqueado_hasta > ahora:
        causa = ResultadoIngreso.USUARIO_BLOQUEADO
    elif not clave_valida:
        causa = ResultadoIngreso.CLAVE_ERRADA
    elif not usuario.is_active:
        causa = ResultadoIngreso.USUARIO_INACTIVO
    elif not usuario.unidad.activa:
        causa = ResultadoIngreso.UNIDAD_INACTIVA
    else:
        causa = ResultadoIngreso.EXITOSO

    if usuario is not None:
        if causa == ResultadoIngreso.EXITOSO:
            usuario.intentos_fallidos = 0
            usuario.bloqueado_hasta = None
        elif causa == ResultadoIngreso.CLAVE_ERRADA:
            usuario.intentos_fallidos += 1
            if usuario.intentos_fallidos >= settings.INTENTOS_ANTES_DE_BLOQUEO:
                usuario.bloqueado_hasta = ahora + timedelta(minutes=settings.MINUTOS_DE_BLOQUEO)
                usuario.intentos_fallidos = 0
        usuario.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])

    IntentoIngreso.objects.create(
        credencial_intentada=credencial[:60],
        usuario=usuario,
        resultado=causa,
        direccion_ip=ip,
        agente=agente[:300],
    )
    return ResultadoAutenticacion(
        usuario=usuario if causa == ResultadoIngreso.EXITOSO else None, causa=causa
    )
