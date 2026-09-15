"""Configuracion del servicio de IA.

El modelo NO se fija en el codigo: va en configuracion (B.3). Que modelos estan
disponibles Y APROBADOS para procesar «Informacion Publico Clasificado» es la
pregunta Q12, sin responder.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    """Ajustes leidos del entorno."""

    model_config = SettingsConfigDict(env_prefix="IA_", extra="ignore")

    puerto: int = 8000

    # TODO(JACID) Q12: modelo de texto aprobado para datos clasificados.
    # No se fija aqui un modelo concreto a proposito: elegirlo sin la
    # aprobacion seria decidir por JACID.
    modelo_texto: str = ""
    modelo_embeddings: str = ""

    # Sin GPU (el escenario probable), U1 y U2 son lentos pero utilizables si
    # se ejecutan de forma asincrona (B.3). El diseno es asincrono desde el
    # principio, asi funciona igual con GPU y sin ella.
    inferencia_habilitada: bool = False

    # IA7 — Sin salida de datos. El servicio no tiene ruta a internet por
    # configuracion de red, no solo por convencion de codigo. Esta bandera
    # existe para que el arranque lo deje registrado, no para imponerlo.
    red_cerrada_verificada: bool = False


configuracion = Configuracion()
