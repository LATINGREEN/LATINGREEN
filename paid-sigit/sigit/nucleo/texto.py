from __future__ import annotations

import re
import unicodedata


def normalizar(texto: str) -> str:
    """
    Minúsculas, sin tildes, sin signos y con espacios simples. Es la forma sobre
    la que se buscan duplicados: «Alcaldía de Tumaco» y «ALCALDIA  DE TUMACO.»
    tienen que parecer la misma entidad.
    """
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    solo_letras = re.sub(r"[^0-9a-zA-Z]+", " ", sin_tildes).lower()
    return re.sub(r"\s+", " ", solo_letras).strip()
