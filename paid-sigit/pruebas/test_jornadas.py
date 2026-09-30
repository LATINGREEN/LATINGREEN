from __future__ import annotations

from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction

from sigit.jornadas import adjuntos
from sigit.jornadas.models import Jornada, JornadaPoblacion, JornadaResumen
from sigit.jornadas.servicios import (
    buscar_posibles_duplicados,
    estado_pestanas,
    recalcular_completo,
)
from sigit.nucleo import models as m

from .conftest import sistema

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.4\n%prueba\n"


def _datos_formulario(unidad: m.Unidad, **cambios: object) -> dict[str, object]:
    tumaco = m.Municipio.objects.get(codigo_dane="52835")
    datos = {
        "unidad": unidad.pk,
        "tipo_jornada": m.TipoJornada.objects.get(codigo="CONJUNTA").pk,
        "fecha_inicio": "2026-09-10",
        "fecha_ejecucion": "2026-09-10",
        "lugar": "Coliseo municipal de Tumaco",
        "departamento": tumaco.departamento_id,
        "municipio": tumaco.pk,
        "descripcion": "Jornada de salud",
        "latitud_grados": 1,
        "latitud_minutos": 48,
        "latitud_segundos": "24.1",
        "latitud_hemisferio": "N",
        "longitud_grados": 78,
        "longitud_minutos": 45,
        "longitud_segundos": "53",
        "longitud_hemisferio": "W",
        "participo_ejc": "no",
        "participo_fac": "no",
        "poblacion_afecta_tropa": "nr",
    }
    datos.update(cambios)
    return datos


def test_registrar_jornada_por_la_interfaz(ingresar, unidades):
    cliente = ingresar("BIM23")
    r = cliente.post("/jornadas/nueva/", _datos_formulario(unidades["BIM23"]))
    assert r.status_code == 302, r.content.decode()[:2000]
    sistema()
    jornada = Jornada.objects.get()
    assert jornada.codigo.startswith("2813304R92026")
    assert jornada.participo_arc is True
    assert jornada.poblacion_afecta_tropa is None
    assert float(jornada.latitud_decimal) == pytest.approx(1.806694, abs=1e-5)
    assert float(jornada.longitud_decimal) < 0


def test_sin_elegir_si_o_no_no_se_guarda(ingresar, unidades):
    """Nada viene marcado de antemano: quien no elige, no guarda."""
    cliente = ingresar("BIM23")
    datos = _datos_formulario(unidades["BIM23"])
    del datos["participo_ejc"]
    r = cliente.post("/jornadas/nueva/", datos)
    assert r.status_code == 200
    sistema()
    assert not Jornada.objects.exists()


def test_coordenadas_fuera_de_colombia_se_rechazan(ingresar, unidades):
    cliente = ingresar("BIM23")
    r = cliente.post(
        "/jornadas/nueva/", _datos_formulario(unidades["BIM23"], longitud_hemisferio="E")
    )
    assert "fuera de Colombia" in r.content.decode()


def test_una_jornada_parecida_exige_confirmacion(ingresar, unidades, crear_jornada):
    crear_jornada("BIM23", lugar="Coliseo municipal de Tumaco", fecha=date(2026, 9, 11))
    cliente = ingresar("BIM23")
    datos = _datos_formulario(unidades["BIM23"], lugar="Coliseo Municipal Tumaco")
    r = cliente.post("/jornadas/nueva/", datos)
    assert r.status_code == 200
    assert "Encontramos jornadas parecidas" in r.content.decode()
    sistema()
    assert Jornada.objects.count() == 1
    datos["confirmo_no_duplicado"] = "on"
    r = cliente.post("/jornadas/nueva/", datos)
    assert r.status_code == 302
    sistema()
    assert Jornada.objects.count() == 2


def test_duplicados_por_lugar_semejante_y_fecha_cercana(crear_jornada):
    existente = crear_jornada(lugar="Escuela rural El Carmen", fecha=date(2026, 3, 5))
    tumaco = m.Municipio.objects.get(codigo_dane="52835")
    parecidas = buscar_posibles_duplicados(
        municipio_id=tumaco.pk, fecha_ejecucion=date(2026, 3, 7), lugar="escuela rural el carmen"
    )
    assert [p.id for p in parecidas] == [existente.pk]
    lejos = buscar_posibles_duplicados(
        municipio_id=tumaco.pk, fecha_ejecucion=date(2026, 5, 1), lugar="Escuela rural El Carmen"
    )
    assert lejos == []


def test_registrar_otra_como_esta_no_copia_las_fechas(ingresar, crear_jornada):
    base = crear_jornada()
    cliente = ingresar("BIM23")
    html = cliente.get(f"/jornadas/nueva/?basada_en={base.pk}").content.decode()
    assert 'value="Coliseo municipal de Tumaco"' in html
    assert 'name="fecha_ejecucion" value=' not in html


def test_participo_arc_siempre_verdadero_lo_impone_la_base(crear_jornada):
    jornada = crear_jornada()
    with pytest.raises(IntegrityError), transaction.atomic():
        Jornada.objects.filter(pk=jornada.pk).update(participo_arc=False)


def test_la_jornada_se_completa_con_las_once_pestanas(ingresar, crear_jornada):
    jornada = crear_jornada()
    cliente = ingresar("BIM23")
    catalogo = {
        "tipo-operacion": {"tipo_operacion": m.TipoOperacion.objects.first().pk},
        "servicios": {"servicio": m.ServicioPrestado.objects.first().pk, "cantidad": 12},
        "poblacion": {"grupo": m.GrupoPoblacional.objects.first().pk, "cantidad_personas": 40},
        "medios-difusion": {"medio": m.MedioDifusion.objects.first().pk},
        "medios-utilizados": {"medio": m.MedioUtilizado.objects.first().pk, "cantidad": 1},
        "recursos": {"tipo_recurso": m.TipoRecurso.objects.first().pk, "cantidad": "20"},
        "bienes-donados": {
            "tipo_bien": m.TipoBienDonado.objects.first().pk,
            "descripcion": "Mercados",
            "cantidad": "10",
        },
        "resumen": {"texto": "Sin novedad."},
    }
    from sigit.maestros.models import Entidad

    entidad = Entidad.objects.create(
        nombre="Hospital de Tumaco", tipo=m.TipoEntidad.objects.first(), unidad=jornada.unidad
    )
    catalogo["entidades-servicios"] = {"entidad": entidad.pk}
    catalogo["entidades-apoyadas"] = {"entidad": entidad.pk}
    for clave, datos in catalogo.items():
        r = cliente.post(
            f"/jornadas/{jornada.pk}/pestana/{clave}/agregar/", datos, HTTP_HX_REQUEST="true"
        )
        assert r.status_code == 200 and "Fila agregada" in r.content.decode(), clave
    sistema()
    jornada.refresh_from_db()
    assert not jornada.registro_completo  # Falta el soporte.
    r = cliente.post(
        f"/jornadas/{jornada.pk}/soportes/cargar/",
        {"archivo": SimpleUploadedFile("acta.pdf", PDF, "application/pdf")},
    )
    assert "Soporte cargado" in r.content.decode()
    sistema()
    jornada.refresh_from_db()
    assert jornada.registro_completo
    assert all(p["completa"] for p in estado_pestanas(jornada))


def test_el_mismo_elemento_no_se_repite_en_una_pestana(ingresar, crear_jornada):
    jornada = crear_jornada()
    grupo = m.GrupoPoblacional.objects.first()
    JornadaPoblacion.objects.create(jornada=jornada, grupo=grupo, cantidad_personas=5)
    cliente = ingresar("BIM23")
    r = cliente.post(
        f"/jornadas/{jornada.pk}/pestana/poblacion/agregar/",
        {"grupo": grupo.pk, "cantidad_personas": 9},
        HTTP_HX_REQUEST="true",
    )
    assert "Fila agregada" not in r.content.decode()
    sistema()
    assert JornadaPoblacion.objects.filter(jornada=jornada).count() == 1


def test_resumen_se_guarda_una_sola_vez_y_se_edita(ingresar, crear_jornada):
    jornada = crear_jornada()
    cliente = ingresar("BIM23")
    for texto in ("Primero", "Corregido"):
        cliente.post(f"/jornadas/{jornada.pk}/pestana/resumen/agregar/", {"texto": texto})
    sistema()
    assert list(JornadaResumen.objects.filter(jornada=jornada).values_list("texto", flat=True)) == [
        "Corregido"
    ]


def test_otra_unidad_no_abre_la_jornada(ingresar, crear_jornada):
    jornada = crear_jornada("BIM23")
    assert ingresar("BIM24").get(f"/jornadas/{jornada.pk}/").status_code == 404
    assert ingresar("FNP").get(f"/jornadas/{jornada.pk}/").status_code == 200


def test_consulta_no_puede_registrar(ingresar):
    assert ingresar("FNP").get("/jornadas/nueva/").status_code == 403


def test_retirar_es_borrado_logico(ingresar, crear_jornada):
    jornada = crear_jornada()
    ingresar("BIM23").post(f"/jornadas/{jornada.pk}/eliminar/")
    sistema()
    assert not Jornada.vigentes.filter(pk=jornada.pk).exists()
    assert Jornada.objects.filter(pk=jornada.pk, eliminado_en__isnull=False).exists()


# ── Soportes ────────────────────────────────────────────────────────────────
def test_un_ejecutable_renombrado_no_entra(crear_jornada, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    jornada = crear_jornada()
    with pytest.raises(adjuntos.SoporteRechazado, match="no corresponde"):
        adjuntos.cargar(
            jornada, SimpleUploadedFile("acta.pdf", b"MZ\x90\x00ejecutable", "application/pdf")
        )


def test_extension_no_permitida(crear_jornada, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    with pytest.raises(adjuntos.SoporteRechazado, match="no está permitida"):
        adjuntos.cargar(
            crear_jornada(), SimpleUploadedFile("script.sh", b"#!/bin/sh", "text/plain")
        )


def test_la_cuota_es_agregada_por_jornada(crear_jornada, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.CUOTA_ADJUNTOS_BYTES = 40
    jornada = crear_jornada()
    adjuntos.cargar(jornada, SimpleUploadedFile("a.pdf", PDF + b"a" * 5))
    with pytest.raises(adjuntos.SoporteRechazado, match="cuota"):
        adjuntos.cargar(jornada, SimpleUploadedFile("b.pdf", PDF + b"b" * 8))


def test_el_mismo_archivo_no_entra_dos_veces(crear_jornada, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    jornada = crear_jornada()
    adjuntos.cargar(jornada, SimpleUploadedFile("a.pdf", PDF))
    with pytest.raises(adjuntos.SoporteRechazado, match="ya está cargado"):
        adjuntos.cargar(jornada, SimpleUploadedFile("copia.pdf", PDF))


def test_recalcular_completo_no_marca_sin_soportes(crear_jornada):
    jornada = crear_jornada()
    assert recalcular_completo(jornada) is False
