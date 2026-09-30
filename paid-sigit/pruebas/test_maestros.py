from __future__ import annotations

import pytest

from sigit.maestros.models import Entidad, HerramientaAid, Personal
from sigit.maestros.vistas import entidades_semejantes
from sigit.nucleo import models as m

from .conftest import sistema

pytestmark = pytest.mark.django_db


@pytest.fixture
def alcaldia(unidades) -> Entidad:
    return Entidad.objects.create(
        nombre="Alcaldía Municipal de Tumaco",
        nit="800123456-1",
        unidad=unidades["BIM23"],
        tipo=m.TipoEntidad.objects.get(codigo="PUBLICA"),
        municipio=m.Municipio.objects.get(codigo_dane="52835"),
    )


def test_una_entidad_con_otro_nombre_parecido_se_encuentra(alcaldia):
    assert [e["id"] for e in entidades_semejantes("alcaldia de tumaco")] == [alcaldia.pk]
    assert entidades_semejantes("Hospital San Andrés") == []


def test_el_mismo_nit_es_la_misma_entidad_aunque_se_llame_distinto(alcaldia):
    assert [e["id"] for e in entidades_semejantes("Municipio", nit="800123456-1")] == [alcaldia.pk]


def test_registrar_entidad_parecida_exige_confirmacion(alcaldia, ingresar, unidades):
    cliente = ingresar("BIM24")  # Otra unidad: ve la entidad de BIM23 (maestro compartido).
    datos = {
        "tipo": m.TipoEntidad.objects.get(codigo="PUBLICA").pk,
        "nombre": "Alcaldia de Tumaco",
        "unidad": unidades["BIM24"].pk,
    }
    r = cliente.post("/maestros/entidades/", datos)
    assert "No la registre dos veces" in r.content.decode()
    sistema()
    assert Entidad.objects.count() == 1
    datos["confirmo_distinta"] = "on"
    assert cliente.post("/maestros/entidades/", datos).status_code == 302
    sistema()
    assert Entidad.objects.count() == 2


def test_aviso_en_vivo_de_entidades_semejantes(alcaldia, ingresar):
    r = ingresar("BIM23").get("/maestros/entidades/semejantes/?nombre=Alcaldia%20Tumaco")
    assert "Alcaldía Municipal de Tumaco" in r.content.decode()


def test_la_misma_persona_no_entra_dos_veces(ingresar, unidades):
    cliente = ingresar("BIM23")
    datos = {
        "tipo_documento": m.TipoDocumentoIdentidad.objects.get(codigo="CC").pk,
        "numero_documento": "1234567",
        "nombres": "Ana",
        "apellidos": "Ruiz",
        "unidad": unidades["BIM23"].pk,
    }
    assert cliente.post("/maestros/personal/", datos).status_code == 302
    r = cliente.post("/maestros/personal/", datos)
    assert "ya está registrada" in r.content.decode()
    sistema()
    assert Personal.objects.count() == 1


def test_herramienta_inactiva_exige_observaciones(ingresar, unidades):
    sistema()
    persona = Personal.objects.create(
        tipo_documento=m.TipoDocumentoIdentidad.objects.get(codigo="CC"),
        numero_documento="99",
        nombres="Luis",
        apellidos="Mora",
        unidad=unidades["BIM23"],
    )
    tumaco = m.Municipio.objects.get(codigo_dane="52835")
    datos = {
        "tipo": m.TipoHerramientaAid.objects.get(codigo="EMISORA_INSTITUCIONAL").pk,
        "codigo": "HAID-1",
        "nombre": "Emisora Tumaco",
        "estado": m.EstadoHerramientaAid.objects.get(codigo="INACTIVA").pk,
        "unidad": unidades["BIM23"].pk,
        "departamento": tumaco.departamento_id,
        "municipio": tumaco.pk,
        "fecha_registro": "2026-01-10",
        "responsable": persona.pk,
        "latitud_grados": 1,
        "latitud_minutos": 48,
        "latitud_segundos": "10",
        "latitud_hemisferio": "N",
        "longitud_grados": 78,
        "longitud_minutos": 45,
        "longitud_segundos": "0",
        "longitud_hemisferio": "W",
    }
    cliente = ingresar("BIM23")
    r = cliente.post("/maestros/herramientas/", datos)
    assert "explique por qué" in r.content.decode()
    datos["observaciones"] = "Transmisor dañado; se solicitó reparación."
    assert cliente.post("/maestros/herramientas/", datos).status_code == 302
    sistema()
    assert HerramientaAid.objects.get().estado.codigo == "INACTIVA"


def test_listados_de_maestros_se_pintan(ingresar, alcaldia):
    cliente = ingresar("FNP")  # Solo consulta: ve, pero sin formulario.
    for ruta in ("/maestros/entidades/?q=tumaco", "/maestros/personal/", "/maestros/herramientas/"):
        r = cliente.get(ruta)
        assert r.status_code == 200
        assert (
            "Registrar" not in r.content.decode() or "Registrar entidad" not in r.content.decode()
        )
