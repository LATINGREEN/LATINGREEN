"""
Soportes de la jornada.

- El tipo se decide por el CONTENIDO (firma de los primeros bytes), no por el
  nombre: un ejecutable renombrado a .pdf no entra.
- La cuota es de 10 MB AGREGADOS por jornada, no por archivo.
- El mismo archivo no entra dos veces a la misma jornada (SHA-256).
- Se guardan fuera de los estáticos, con nombre aleatorio; se descargan por una
  vista que pasa por RLS.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Sum

from sigit.nucleo.models import ExtensionPermitida

from .models import Adjunto, Jornada

FIRMAS: list[tuple[bytes, int, str]] = [
    (b"%PDF-", 0, "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"\xff\xd8\xff", 0, "image/jpeg"),
    (b"GIF87a", 0, "image/gif"),
    (b"GIF89a", 0, "image/gif"),
    (b"PK\x03\x04", 0, "application/zip"),
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", 0, "application/x-cfb"),
    (b"ID3", 0, "audio/mpeg"),
    (b"\xff\xfb", 0, "audio/mpeg"),
    (b"ftyp", 4, "video/mp4"),
]


class SoporteRechazado(ValueError):
    pass


def detectar_mime(cabecera: bytes) -> str | None:
    for firma, desplazamiento, mime in FIRMAS:
        if cabecera[desplazamiento : desplazamiento + len(firma)] == firma:
            return mime
    return None


def cuota_usada(jornada: Jornada) -> int:
    return Adjunto.objects.filter(jornada=jornada).aggregate(total=Sum("peso_bytes"))["total"] or 0


@dataclass(frozen=True)
class ResultadoCarga:
    adjunto: Adjunto


def cargar(jornada: Jornada, archivo: UploadedFile) -> ResultadoCarga:
    nombre = Path(archivo.name or "soporte").name[:200]
    extension = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
    permitida = (
        ExtensionPermitida.objects.select_related("categoria").filter(extension=extension).first()
    )
    if permitida is None:
        validas = ", ".join(ExtensionPermitida.objects.values_list("extension", flat=True))
        raise SoporteRechazado(
            f"La extensión .{extension or '?'} no está permitida. Se admiten: {validas}."
        )
    tamano = archivo.size or 0
    if tamano <= 0:
        raise SoporteRechazado("El archivo está vacío.")
    usada = cuota_usada(jornada)
    if usada + tamano > settings.CUOTA_ADJUNTOS_BYTES:
        libre = max(0, settings.CUOTA_ADJUNTOS_BYTES - usada) / 1024 / 1024
        raise SoporteRechazado(
            f"Supera la cuota de 10 MB por jornada. Quedan {libre:.2f} MB libres."
        )
    contenido = archivo.read()
    mime = detectar_mime(contenido[:16])
    if mime is None or mime not in permitida.mimes_esperados:
        raise SoporteRechazado(
            f"El contenido del archivo no corresponde a un .{extension}. No se guardó."
        )
    resumen = hashlib.sha256(contenido).hexdigest()
    if Adjunto.objects.filter(jornada=jornada, resumen_sha256=resumen).exists():
        raise SoporteRechazado("Ese mismo archivo ya está cargado en esta jornada.")
    relativa = Path("jornadas") / str(jornada.pk) / f"{uuid.uuid4().hex}.{extension}"
    destino = Path(settings.MEDIA_ROOT) / relativa
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(contenido)
    adjunto = Adjunto.objects.create(
        jornada=jornada,
        nombre_archivo=nombre,
        extension=extension,
        categoria=permitida.categoria,
        mime_detectado=mime,
        peso_bytes=tamano,
        resumen_sha256=resumen,
        ruta_almacen=str(relativa),
    )
    return ResultadoCarga(adjunto=adjunto)


def ruta_de(adjunto: Adjunto) -> Path:
    raiz = Path(settings.MEDIA_ROOT).resolve()
    ruta = (raiz / adjunto.ruta_almacen).resolve()
    # Defensa en profundidad: la ruta la escribe el sistema, pero se comprueba
    # que no salga de la carpeta de soportes.
    if raiz not in ruta.parents:
        raise SoporteRechazado("Ruta de soporte inválida.")
    return ruta
