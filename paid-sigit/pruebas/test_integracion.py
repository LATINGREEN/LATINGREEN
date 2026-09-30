from __future__ import annotations

import json
from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from sigit.integracion import servicios
from sigit.integracion.models import EstadoRevision, RegistroExterno, SistemaExterno
from sigit.jornadas.models import Jornada, JornadaPoblacion, Origen
from sigit.nucleo import models as m

from .conftest import sistema

pytestmark = pytest.mark.django_db


@pytest.fixture
def sigit(unidades) -> tuple[SistemaExterno, str]:
    sistema_ext = SistemaExterno(
        codigo="SIGIT",
        nombre="SIGIT",
        alcance=SistemaExterno.Alcance.ENTREGA,
        unidad=unidades["JACID"],
    )
    testigo = sistema_ext.emitir_testigo()
    sistema_ext.save()
    return sistema_ext, testigo


@pytest.fixture
def lectura(unidades) -> str:
    sistema_ext = SistemaExterno(
        codigo="SIGO",
        nombre="SIGO",
        alcance=SistemaExterno.Alcance.LECTURA,
        unidad=unidades["BIM24"],
    )
    testigo = sistema_ext.emitir_testigo()
    sistema_ext.save()
    return testigo


def actividad(**cambios: object) -> dict[str, object]:
    datos: dict[str, object] = {
        "id_externo": "RES-1",
        "tipo_jornada": "CONJUNTA",
        "descripcion": "Jornada de la reserva",
        "fecha_ejecucion": "2026-09-20",
        "lugar": "Muelle turístico de Tumaco",
        "municipio_dane": "52835",
        "latitud": "1.80670",
        "longitud": "-78.76470",
        "poblacion": [{"codigo": "ADULTOS", "cantidad": 40}],
        "servicios": [{"codigo": "ODONTOLOGIA", "cantidad": 12}],
    }
    datos.update(cambios)
    return datos


def enviar(testigo: str, actividades: list[dict[str, object]]):
    r = Client().post(
        "/api/v1/integracion/actividades/",
        json.dumps({"actividades": actividades}),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {testigo}",
    )
    sistema()
    return r


def test_solo_se_guarda_el_resumen_del_testigo(sigit):
    sistema_ext, testigo = sigit
    assert testigo not in sistema_ext.resumen_testigo
    assert len(sistema_ext.resumen_testigo) == 64


def test_sin_testigo_o_con_testigo_falso_no_entra(sigit):
    assert enviar("", [actividad()]).status_code in (401, 403)
    r = enviar("sigit_falso", [actividad()])
    assert r.status_code == 401
    assert r.json()["codigo"] == "NO_AUTENTICADO"


def test_un_sistema_de_lectura_no_puede_entregar(lectura):
    assert enviar(lectura, [actividad()]).status_code == 403


def test_entrega_idempotente(sigit):
    _, testigo = sigit
    r = enviar(testigo, [actividad()])
    assert r.status_code == 202
    assert r.json()["resultados"][0]["resultado"] == "RECIBIDA"
    assert enviar(testigo, [actividad()]).json()["resultados"][0]["resultado"] == "REPETIDA"
    cambiada = enviar(testigo, [actividad(lugar="Coliseo de Tumaco")]).json()
    assert cambiada["resultados"][0]["resultado"] == "ACTUALIZADA"
    assert RegistroExterno.objects.count() == 1
    assert not Jornada.objects.exists()  # Nada entra sin la revisión de JACID.


def test_datos_invalidos_se_devuelven_por_actividad(sigit):
    _, testigo = sigit
    r = enviar(
        testigo,
        [
            actividad(id_externo="BUENA"),
            actividad(id_externo="MALA", municipio_dane="99999", longitud="78.7"),
            actividad(id_externo="OTRA", poblacion=[{"codigo": "NO_EXISTE", "cantidad": 3}]),
        ],
    )
    resultados = {x["id_externo"]: x for x in r.json()["resultados"]}
    assert resultados["BUENA"]["resultado"] == "RECIBIDA"
    assert resultados["MALA"]["resultado"] == "RECHAZADA"
    assert "municipio_dane" in resultados["MALA"]["errores"]
    assert "NO_EXISTE" in json.dumps(resultados["OTRA"]["errores"], ensure_ascii=False)


def test_aprobar_crea_la_jornada_con_origen_sigit(sigit, usuarios, ingresar):
    _, testigo = sigit
    enviar(testigo, [actividad()])
    registro = RegistroExterno.objects.get()
    cliente = ingresar("JACID")
    r = cliente.post(
        f"/integracion/bandeja/{registro.pk}/",
        {
            "accion": "aprobar",
            "unidad": usuarios["BIM23"].unidad_id,
            "tipo_jornada": m.TipoJornada.objects.get(codigo="ESTRATEGICA").pk,  # Reclasificada.
            "participo_ejc": "no",
            "participo_fac": "si",
            "poblacion_afecta_tropa": "nr",
        },
    )
    assert r.status_code == 302
    sistema()
    registro.refresh_from_db()
    jornada = registro.jornada
    assert registro.estado == EstadoRevision.APROBADO
    assert jornada.origen == Origen.SIGIT
    assert jornada.tipo_jornada.codigo == "ESTRATEGICA"
    assert jornada.fecha_inicio == date(2026, 9, 20)
    assert JornadaPoblacion.objects.get(jornada=jornada).cantidad_personas == 40
    estado = (
        Client()
        .get(
            f"/api/v1/integracion/actividades/{registro.id_externo}/",
            HTTP_AUTHORIZATION=f"Bearer {testigo}",
        )
        .json()
    )
    assert estado["estado"] == "APROBADO" and estado["codigo_jornada"] == jornada.codigo
    sistema()
    # Ya revisada: reenviarla cambiada no la reescribe.
    assert (
        enviar(testigo, [actividad(lugar="Otro")]).json()["resultados"][0]["resultado"]
        == "RECHAZADA"
    )


def test_una_actividad_ya_registrada_exige_confirmacion(sigit, crear_jornada, ingresar, usuarios):
    crear_jornada("BIM23", lugar="Muelle turístico de Tumaco", fecha=date(2026, 9, 19))
    _, testigo = sigit
    r = enviar(testigo, [actividad()])
    assert r.json()["resultados"][0]["posibles_duplicados"] == 1
    registro = RegistroExterno.objects.get()
    cliente = ingresar("JACID")
    datos = {
        "accion": "aprobar",
        "unidad": usuarios["BIM23"].unidad_id,
        "tipo_jornada": m.TipoJornada.objects.get(codigo="CONJUNTA").pk,
        "participo_ejc": "no",
        "participo_fac": "no",
        "poblacion_afecta_tropa": "no",
    }
    r = cliente.post(f"/integracion/bandeja/{registro.pk}/", datos)
    assert r.status_code == 200 and "jornadas parecidas" in r.content.decode()
    sistema()
    assert Jornada.objects.count() == 1


def test_rechazar_exige_motivo(sigit, ingresar):
    _, testigo = sigit
    enviar(testigo, [actividad()])
    registro = RegistroExterno.objects.get()
    cliente = ingresar("JACID")
    cliente.post(f"/integracion/bandeja/{registro.pk}/rechazar/", {"motivo": "  "})
    sistema()
    registro.refresh_from_db()
    assert registro.estado == EstadoRevision.PENDIENTE
    cliente.post(f"/integracion/bandeja/{registro.pk}/rechazar/", {"motivo": "Duplicada"})
    sistema()
    registro.refresh_from_db()
    assert registro.estado == EstadoRevision.RECHAZADO and registro.motivo_rechazo == "Duplicada"


def test_un_operador_no_ve_la_bandeja(ingresar):
    assert ingresar("BIM23").get("/integracion/bandeja/").status_code == 403


def test_archivo_plano_por_la_misma_via(sigit, ingresar):
    sistema_ext, _ = sigit
    contenido = (
        servicios.plantilla_csv()
        .replace("CODIGO_GRUPO", "ADULTOS")
        .replace("CODIGO_SERVICIO", "ODONTOLOGIA")
    )
    cliente = ingresar("JACID")
    r = cliente.post(
        "/integracion/archivo/",
        {
            "sistema": sistema_ext.pk,
            "archivo": SimpleUploadedFile("lote.csv", contenido.encode("utf-8"), "text/csv"),
        },
    )
    assert r.status_code == 200
    assert "Resultado del lote" in r.content.decode()
    sistema()
    registro = RegistroExterno.objects.get(id_externo="RES-2026-0001")
    assert registro.datos["poblacion"] == [{"codigo": "ADULTOS", "cantidad": 40}]


# ── API de lectura ──────────────────────────────────────────────────────────
def test_lectura_de_catalogos_y_ambito(lectura, crear_jornada):
    crear_jornada("BIM23")
    crear_jornada("BIM24", lugar="Muelle de Cartagena", dane="13001")
    cabecera = {"HTTP_AUTHORIZATION": f"Bearer {lectura}"}
    tipos = Client().get("/api/v1/catalogos/tipo_jornada/", **cabecera).json()
    assert {t["codigo"] for t in tipos} == {"BINACIONAL", "CONJUNTA", "ESTRATEGICA"}
    jornadas = Client().get("/api/v1/jornadas/", **cabecera).json()
    # El sistema consulta a nombre de BIM24: RLS no le muestra lo de BIM23.
    assert {j["unidad"] for j in jornadas["results"]} == {"1111853"}
    assert Client().get("/api/v1/catalogos/no_existe/", **cabecera).status_code == 404


def test_esquema_openapi(ingresar):
    r = ingresar("BIM23").get("/api/v1/esquema/")
    assert r.status_code == 200
    assert b"/api/v1/integracion/actividades/" in r.content
