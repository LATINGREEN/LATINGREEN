from __future__ import annotations

from decimal import Decimal

from django import template
from django.contrib.humanize.templatetags.humanize import intcomma

register = template.Library()


@register.filter
def atributo(objeto: object, nombre: str) -> object:
    """Valor presentable de un campo por nombre: catálogo → nombre, None → «—»."""
    valor = getattr(objeto, nombre, None)
    if valor is None or valor == "":
        return "—"
    if isinstance(valor, Decimal):
        return intcomma(valor.normalize() if valor == valor.to_integral() else valor)
    if isinstance(valor, int) and not isinstance(valor, bool):
        return intcomma(valor)
    return valor


@register.filter
def numerico(objeto: object, nombre: str) -> bool:
    return isinstance(getattr(objeto, nombre, None), int | Decimal)


@register.filter
def compacto(valor: object) -> str:
    """4146900000 → «4.147 M»: una cifra grande que cabe en una tarjeta."""
    try:
        numero = float(valor)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return "—"
    for limite, sufijo in ((1e12, " B"), (1e6, " M"), (1e3, " mil")):
        if abs(numero) >= limite:
            return f"{intcomma(round(numero / limite, 1)).replace('.0', '')}{sufijo}"
    return intcomma(round(numero))
