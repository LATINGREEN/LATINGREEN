"""Pruebas del esqueleto del servicio de IA.

La que importa de verdad no esta aqui: es la de la Puerta 6, «con el servicio
de IA **apagado**, toda la Parte A sigue pasando sus tests» (IA6). Esa vive en
la Parte A, porque es la Parte A la que tiene que sobrevivir sin esto.
"""

from fastapi.testclient import TestClient

from paid_ia.principal import app

cliente = TestClient(app)


def test_salud_responde_200() -> None:
    """La sonda responde aunque no haya modelo: el backend necesita distinguir
    «no hay servicio» de «servicio sin modelo», y ninguno puede bloquear."""
    respuesta = cliente.get("/salud")
    assert respuesta.status_code == 200


def test_sin_modelo_configurado_reporta_degradado() -> None:
    """IA6 — degradacion limpia, no un error."""
    cuerpo = cliente.get("/salud").json()
    assert cuerpo["estado"] == "degradado"
    assert cuerpo["inferencia_habilitada"] is False
    assert cuerpo["modelo_texto"] is None


def test_no_expone_endpoints_de_las_fases_6_y_7() -> None:
    """La Parte B se construye por fases. Un endpoint a medias es peor que uno
    ausente: la interfaz creeria que puede llamarlo."""
    rutas = {ruta.path for ruta in app.routes}  # type: ignore[attr-defined]
    assert "/embeddings" not in rutas
    assert "/extraer" not in rutas
