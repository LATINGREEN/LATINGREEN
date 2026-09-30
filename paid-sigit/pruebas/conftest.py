"""
Accesorios de prueba.

Las pruebas corren contra PostgreSQL real con las políticas RLS activas y
FORZADAS (también para el rol dueño), así que cada prueba necesita contexto.
Cada prueba corre en una transacción: el contexto fijado con set_config(…, true)
dura hasta el final de la prueba o hasta que otra petición lo cambie.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import Client

from sigit.jornadas import models as j
from sigit.jornadas.servicios import guardar_con_codigo
from sigit.nucleo import models as m
from sigit.nucleo.contexto_bd import establecer_contexto

CLAVE = "Clave-de-prueba-2026"


def sistema() -> None:
    """Vuelve al contexto de sistema (ve toda la jerarquía)."""
    establecer_contexto("/", None)


def como(unidad: m.Unidad) -> None:
    establecer_contexto(unidad.ruta, None)


@pytest.fixture(autouse=True)
def _contexto(db: Any) -> None:
    sistema()


@pytest.fixture
def catalogos(db: Any) -> None:
    call_command("sembrar", stdout=open("/dev/null", "w"))  # noqa: SIM115
    sistema()
    for modelo, codigo in (
        (m.GrupoPoblacional, "ADULTOS"),
        (m.ServicioPrestado, "ODONTOLOGIA"),
        (m.TipoOperacion, "ACCION_INTEGRAL"),
        (m.MedioDifusion, "RADIO"),
        (m.MedioUtilizado, "EMBARCACION"),
        (m.TipoRecurso, "COMBUSTIBLE"),
        (m.TipoBienDonado, "MERCADOS"),
    ):
        modelo.objects.get_or_create(codigo=codigo, defaults={"nombre": codigo.title()})
    tumaco = m.Municipio.objects.get_or_create(
        codigo_dane="52835",
        defaults={"nombre": "Tumaco", "departamento": m.Departamento.objects.get(codigo_dane="52")},
    )[0]
    m.Municipio.objects.get_or_create(
        codigo_dane="13001",
        defaults={
            "nombre": "Cartagena",
            "departamento": m.Departamento.objects.get(codigo_dane="13"),
        },
    )
    assert tumaco.pk


@pytest.fixture
def unidades(catalogos: None) -> dict[str, m.Unidad]:
    niveles = {n.codigo: n for n in m.NivelJerarquia.objects.all()}
    resultado: dict[str, m.Unidad] = {}
    for sigla, codigo, nivel, superior in (
        ("JACID", "1000001", "FUERZA", None),
        ("FNP", "2510444", "COMPONENTE", "JACID"),
        ("BIM23", "2813304", "UNIDAD_TACTICA", "FNP"),
        ("BIM24", "1111853", "UNIDAD_TACTICA", "JACID"),
    ):
        unidad = m.Unidad.objects.create(
            sigla=sigla,
            codigo=codigo,
            nombre=sigla,
            nivel=niveles[nivel],
            superior=resultado.get(superior) if superior else None,
        )
        unidad.refresh_from_db()
        resultado[sigla] = unidad
    return resultado


@pytest.fixture
def usuarios(unidades: dict[str, m.Unidad]) -> dict[str, m.Usuario]:
    roles = {
        "JACID": [m.Rol.REVISOR_JACID, m.Rol.ADMINISTRADOR],
        "BIM23": [m.Rol.OPERADOR],
        "BIM24": [m.Rol.OPERADOR],
        "FNP": [m.Rol.CONSULTA],
    }
    resultado = {}
    for sigla, unidad in unidades.items():
        usuario = m.Usuario.objects.create_user(
            f"{sigla}_PAID", CLAVE, unidad=unidad, nombre_responsable=sigla
        )
        usuario.groups.set(Group.objects.filter(name__in=roles[sigla]))
        resultado[sigla] = usuario
    return resultado


def resolver_captcha(html: str) -> tuple[str, str]:
    reto = re.search(r"¿Cuánto es (\d+) ([+−]) (\d+)\?", html)
    assert reto, "No se encontró el reto de captcha"
    a, signo, b = int(reto[1]), reto[2], int(reto[3])
    id_captcha = re.search(r'name="id_captcha" value="(\d+)"', html)
    assert id_captcha
    return id_captcha[1], str(a + b if signo == "+" else a - b)


@pytest.fixture
def ingresar(usuarios: dict[str, m.Usuario]) -> Callable[[str], Client]:
    def _ingresar(sigla: str) -> Client:
        cliente = Client()
        pagina = cliente.get("/ingreso/").content.decode()
        id_captcha, respuesta = resolver_captcha(pagina)
        r = cliente.post(
            "/ingreso/",
            {
                "credencial": f"{sigla}_PAID",
                "clave": CLAVE,
                "id_captcha": id_captcha,
                "respuesta_captcha": respuesta,
            },
        )
        assert r.status_code == 302, "El ingreso de prueba falló"
        sistema()
        return cliente

    return _ingresar


GMS_TUMACO = {
    "latitud_grados": 1,
    "latitud_minutos": 48,
    "latitud_segundos": Decimal("24.12"),
    "latitud_hemisferio": "N",
    "longitud_grados": 78,
    "longitud_minutos": 45,
    "longitud_segundos": Decimal("53.0"),
    "longitud_hemisferio": "W",
}


@pytest.fixture
def crear_jornada(unidades: dict[str, m.Unidad]) -> Callable[..., j.Jornada]:
    def _crear(
        sigla: str = "BIM23",
        lugar: str = "Coliseo municipal de Tumaco",
        fecha: date = date(2026, 9, 10),
        dane: str = "52835",
    ) -> j.Jornada:
        jornada = j.Jornada(
            unidad=unidades[sigla],
            tipo_jornada=m.TipoJornada.objects.get(codigo="CONJUNTA"),
            descripcion="Jornada de prueba",
            fecha_inicio=fecha,
            fecha_ejecucion=fecha,
            lugar=lugar,
            municipio=m.Municipio.objects.get(codigo_dane=dane),
            participo_ejc=False,
            participo_fac=False,
            **GMS_TUMACO,
        )
        return guardar_con_codigo(jornada)

    return _crear
