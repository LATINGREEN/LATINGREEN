"""
Aislamiento por unidad con Row Level Security.

Estas pruebas existen porque el defecto que previenen es SILENCIOSO: una fuga
de datos entre unidades no produce ningún error, solo datos de más.
"""

from __future__ import annotations

import pytest
from django.db import connection, transaction
from django.db.utils import ProgrammingError

from sigit.jornadas.models import Jornada, JornadaPoblacion
from sigit.maestros.models import Entidad
from sigit.nucleo import models as m
from sigit.nucleo.contexto_bd import establecer_contexto

from .conftest import como, sistema

pytestmark = pytest.mark.django_db


def test_la_ruta_la_calcula_la_base(unidades):
    assert unidades["JACID"].ruta == f"/{unidades['JACID'].pk}/"
    assert (
        unidades["BIM23"].ruta
        == f"/{unidades['JACID'].pk}/{unidades['FNP'].pk}/{unidades['BIM23'].pk}/"
    )


def test_la_ruta_no_se_puede_escribir_a_mano(unidades):
    m.Unidad.objects.filter(pk=unidades["BIM23"].pk).update(ruta="/")
    assert m.Unidad.objects.get(pk=unidades["BIM23"].pk).ruta.endswith(f"/{unidades['BIM23'].pk}/")


def test_recolocar_una_unidad_recalcula_sus_subordinadas(unidades):
    fnp = unidades["FNP"]
    fnp.superior = unidades["BIM24"]
    fnp.save()
    bim23 = m.Unidad.objects.get(pk=unidades["BIM23"].pk)
    assert bim23.ruta.startswith(m.Unidad.objects.get(pk=unidades["BIM24"].pk).ruta)


def test_un_ciclo_en_la_jerarquia_se_rechaza(unidades):
    jacid = unidades["JACID"]
    jacid.superior = unidades["BIM23"]
    with pytest.raises(Exception, match="Ciclo"), transaction.atomic():
        jacid.save()


def test_sin_contexto_no_se_ve_nada(crear_jornada):
    crear_jornada()
    establecer_contexto("", None)
    assert Jornada.objects.count() == 0


def test_cada_unidad_ve_lo_suyo_y_lo_de_sus_subordinadas(unidades, crear_jornada):
    crear_jornada("BIM23")
    crear_jornada("BIM24", lugar="Muelle de Cartagena", dane="13001")
    como(unidades["BIM23"])
    assert set(Jornada.objects.values_list("unidad__sigla", flat=True)) == {"BIM23"}
    como(unidades["BIM24"])
    assert set(Jornada.objects.values_list("unidad__sigla", flat=True)) == {"BIM24"}
    como(unidades["FNP"])  # Superior de BIM23, no de BIM24.
    assert set(Jornada.objects.values_list("unidad__sigla", flat=True)) == {"BIM23"}
    como(unidades["JACID"])
    assert Jornada.objects.count() == 2


def test_las_pestanas_heredan_el_ambito_de_su_jornada(unidades, crear_jornada):
    jornada = crear_jornada("BIM23")
    JornadaPoblacion.objects.create(
        jornada=jornada, grupo=m.GrupoPoblacional.objects.first(), cantidad_personas=10
    )
    como(unidades["BIM24"])
    assert JornadaPoblacion.objects.count() == 0


def test_no_se_puede_escribir_en_la_unidad_de_otro(unidades, crear_jornada):
    como(unidades["BIM24"])
    with pytest.raises(ProgrammingError, match="row-level security"), transaction.atomic():
        crear_jornada("BIM23")


def test_las_entidades_se_leen_desde_cualquier_unidad_pero_se_escriben_en_la_propia(unidades):
    tipo = m.TipoEntidad.objects.first()
    Entidad.objects.create(nombre="Alcaldía de Tumaco", tipo=tipo, unidad=unidades["BIM23"])
    como(unidades["BIM24"])
    assert Entidad.objects.filter(nombre="Alcaldía de Tumaco").exists()
    with pytest.raises(ProgrammingError, match="row-level security"), transaction.atomic():
        Entidad.objects.create(nombre="Otra", tipo=tipo, unidad=unidades["BIM23"])
    actualizadas = Entidad.objects.filter(nombre="Alcaldía de Tumaco").update(contacto="x")
    assert actualizadas == 0  # La ve, pero no puede cambiarla.


def test_el_contexto_no_sobrevive_a_la_transaccion(unidades, crear_jornada):
    """
    set_config(…, true) es SET LOCAL. Si fuera SET, el contexto quedaría pegado
    a la conexión y la siguiente petición (de otra unidad) lo heredaría.
    """
    crear_jornada("BIM23")
    with connection.cursor() as cursor:
        cursor.execute("SAVEPOINT prueba")
        cursor.execute("SELECT set_config('app.ruta_unidad', %s, true)", [unidades["BIM23"].ruta])
        cursor.execute("SELECT current_setting('app.ruta_unidad', true)")
        assert cursor.fetchone()[0] == unidades["BIM23"].ruta
        cursor.execute("ROLLBACK TO SAVEPOINT prueba")
        cursor.execute("SELECT current_setting('app.ruta_unidad', true)")
        assert cursor.fetchone()[0] == "/"  # Volvió al del sistema, no se quedó el de BIM23.


def test_el_contexto_exige_transaccion(settings):
    with connection.cursor():
        pass
    # Dentro de la prueba siempre hay transacción; se simula el caso sin ella.
    en_bloque = connection.in_atomic_block
    connection.in_atomic_block = False
    try:
        with pytest.raises(RuntimeError, match=r"transaction\.atomic"):
            establecer_contexto("/", None)
    finally:
        connection.in_atomic_block = en_bloque


def test_la_bitacora_registra_quien_cambio_que(usuarios, crear_jornada):
    establecer_contexto("/", usuarios["BIM23"].pk)
    jornada = crear_jornada("BIM23")
    Jornada.objects.filter(pk=jornada.pk).update(lugar="Otro lugar")
    entradas = m.Bitacora.objects.filter(tabla="jornadas_jornada", id_registro=jornada.pk).order_by(
        "id"
    )
    assert [e.operacion for e in entradas] == ["INSERT", "UPDATE"]
    assert entradas[1].datos_antes["lugar"] != entradas[1].datos_despues["lugar"]
    assert entradas[1].id_usuario == usuarios["BIM23"].pk
    jornada.refresh_from_db()
    assert jornada.creado_por_id == usuarios["BIM23"].pk
    sistema()
