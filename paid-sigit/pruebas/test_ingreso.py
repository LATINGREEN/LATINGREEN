from __future__ import annotations

from unittest import mock

import pytest
from django.test import Client

from sigit.nucleo import ingreso
from sigit.nucleo.models import IntentoIngreso, ResultadoIngreso, Usuario
from sigit.nucleo.red import ip_de_origen

from .conftest import CLAVE, resolver_captcha

pytestmark = pytest.mark.django_db


def ultimo_intento() -> IntentoIngreso:
    return IntentoIngreso.objects.order_by("-id").first()


def _intentar(cliente: Client, credencial: str, clave: str, captcha_bien: bool = True):
    pagina = cliente.get("/ingreso/").content.decode()
    id_captcha, respuesta = resolver_captcha(pagina)
    if not captcha_bien:
        respuesta = str(int(respuesta) + 1)
    return cliente.post(
        "/ingreso/",
        {
            "credencial": credencial,
            "clave": clave,
            "id_captcha": id_captcha,
            "respuesta_captcha": respuesta,
        },
    )


def test_ingreso_correcto(usuarios):
    r = _intentar(Client(), "BIM23_PAID", CLAVE)
    assert r.status_code == 302
    assert ultimo_intento().resultado == ResultadoIngreso.EXITOSO


@pytest.mark.parametrize(
    "credencial,clave,captcha,causa",
    [
        ("BIM23_PAID", "errada-12345678", True, ResultadoIngreso.CLAVE_ERRADA),
        ("NOEXISTE_PAID", CLAVE, True, ResultadoIngreso.CREDENCIAL_INEXISTENTE),
        ("BIM23_PAID", CLAVE, False, ResultadoIngreso.CAPTCHA_ERRADO),
    ],
)
def test_toda_falla_dice_lo_mismo_y_la_base_distingue(usuarios, credencial, clave, captcha, causa):
    r = _intentar(Client(), credencial, clave, captcha)
    assert r.status_code == 401
    assert "Credenciales inválidas" in r.content.decode()
    assert ultimo_intento().resultado == causa


def test_la_clave_se_verifica_aunque_la_credencial_no_exista(usuarios):
    """Así el tiempo de respuesta no delata qué credenciales existen."""
    with mock.patch.object(ingreso, "check_password", wraps=ingreso.check_password) as espia:
        _intentar(Client(), "NOEXISTE_PAID", CLAVE)
    assert espia.call_count == 1


def test_captcha_de_un_solo_uso(usuarios):
    cliente = Client()
    pagina = cliente.get("/ingreso/").content.decode()
    id_captcha, respuesta = resolver_captcha(pagina)
    datos = {
        "credencial": "BIM23_PAID",
        "clave": "errada-12345678",
        "id_captcha": id_captcha,
        "respuesta_captcha": respuesta,
    }
    cliente.post("/ingreso/", datos)
    datos["clave"] = CLAVE
    r = Client().post("/ingreso/", datos)  # El mismo reto, reutilizado.
    assert r.status_code == 401
    assert ultimo_intento().resultado == ResultadoIngreso.CAPTCHA_ERRADO


def test_bloqueo_tras_cinco_intentos(usuarios, settings):
    for _ in range(settings.INTENTOS_ANTES_DE_BLOQUEO):
        _intentar(Client(), "BIM23_PAID", "errada-12345678")
    r = _intentar(Client(), "BIM23_PAID", CLAVE)  # Ahora con la clave correcta.
    assert r.status_code == 401
    assert ultimo_intento().resultado == ResultadoIngreso.USUARIO_BLOQUEADO
    assert Usuario.objects.get(credencial="BIM23_PAID").bloqueado_hasta is not None


def test_sin_sesion_se_va_al_ingreso(usuarios):
    r = Client().get("/jornadas/")
    assert r.status_code == 302 and "/ingreso/" in r["Location"]


def test_la_sesion_dura_diez_minutos_deslizantes(settings):
    assert settings.SESSION_COOKIE_AGE == 600
    assert settings.SESSION_SAVE_EVERY_REQUEST is True


def test_cabeceras_de_seguridad(usuarios):
    r = Client().get("/ingreso/")
    politica = r["Content-Security-Policy"]
    assert "script-src 'self'" in politica and "unsafe-inline" not in politica
    assert r["X-Frame-Options"] == "DENY"
    assert r["X-Content-Type-Options"] == "nosniff"


def test_x_forwarded_for_escrita_por_el_cliente_no_cuenta(rf, settings):
    settings.PROXIES_DE_CONFIANZA = 1
    peticion = rf.get("/", HTTP_X_FORWARDED_FOR="10.0.0.1, 203.0.113.9", REMOTE_ADDR="172.18.0.2")
    assert ip_de_origen(peticion) == "203.0.113.9"
    settings.PROXIES_DE_CONFIANZA = 0
    assert ip_de_origen(peticion) == "172.18.0.2"
