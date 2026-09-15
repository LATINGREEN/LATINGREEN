"""API del servicio de IA.

⛔ ESTADO: esqueleto de la Fase 0.

PROMPT.md es explicito en el orden: la Parte B «se construye encima y **nunca
es requisito de funcionamiento** de la Parte A», y la Puerta 5 exige que la
Parte A funcione completa **sin ningun componente de IA desplegado**. Por eso
aqui solo hay `/salud`: los endpoints `/embeddings` y `/extraer` llegan en las
Fases 6 y 7, y no antes.
"""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from paid_ia import __version__
from paid_ia.configuracion import configuracion

app = FastAPI(
    title="PAID — Asistencia por IA",
    version=__version__,
    description=(
        "La IA propone; la persona dispone (IA1). Ningun modelo escribe jamas en "
        "ai.*, org.* ni doc.*: lo unico que puede escribir es una fila en ia.sugerencia."
    ),
)


class RespuestaSalud(BaseModel):
    """Sonda de salud. El backend la usa como cortacircuitos (IA6)."""

    estado: Literal["sano", "degradado"]
    servicio: str = "paid-ia"
    version: str
    # Si es False, la Parte A funciona igual: la asistencia se anuncia como no
    # disponible y nada mas (IA6).
    inferencia_habilitada: bool
    modelo_texto: str | None


@app.get("/salud", response_model=RespuestaSalud)
async def salud() -> RespuestaSalud:
    """Estado del servicio.

    Responde «degradado», no un error, cuando no hay modelo configurado: el
    backend necesita distinguir «no hay servicio» de «el servicio esta pero sin
    modelo», y ninguno de los dos casos puede bloquear a la Parte A.
    """
    tiene_modelo = configuracion.modelo_texto != ""
    return RespuestaSalud(
        estado="sano" if (tiene_modelo and configuracion.inferencia_habilitada) else "degradado",
        version=__version__,
        inferencia_habilitada=configuracion.inferencia_habilitada,
        modelo_texto=configuracion.modelo_texto or None,
    )


# TODO(Fase 6): POST /embeddings — vectores del nombre normalizado de entidad
#   para U3 (deduplicacion semantica). pgvector en la MISMA base PostgreSQL.
#
# TODO(Fase 7): POST /extraer — U1, extraccion estructurada del clavegrama.
#   Requisitos que ya estan decididos y no se negocian:
#     - Decodificacion restringida contra el JSON Schema derivado del mismo Zod
#       que valida el formulario (IA2). No «pedir JSON en el prompt» (PIA3).
#     - Cada valor propuesto viaja con el fragmento exacto del clavegrama
#       (desplazamiento inicial y final) y una confianza. Un campo sin fragmento
#       que lo respalde NO se propone (IA3).
#     - Si una cifra no esta en el texto, el campo se deja VACIO, no estimado (IA4).
#     - Endpoint asincrono: se encola y la propuesta llega por sondeo o SSE (PIA4).
#     - La plantilla del prompt vive en prompts/extraccion.v1.md, versionada en
#       el repositorio, nunca escrita en el codigo.
