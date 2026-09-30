"""
⚠️ El archivo más delicado del proyecto. Léalo entero antes de tocarlo.

Row Level Security decide qué filas ve cada unidad leyendo dos valores de la
sesión de PostgreSQL: `app.ruta_unidad` y `app.id_usuario`. Se fijan con
`set_config(clave, valor, true)`. Ese tercer argumento `true` ES el `is_local`
de `SET LOCAL`: el valor muere al terminar la transacción.

Por qué importa: Django reutiliza conexiones (CONN_MAX_AGE). Con `false` —o con
un `SET` normal— el valor quedaría pegado a la conexión y la siguiente
petición, de OTRA unidad, heredaría el contexto de la anterior: una fuga de
datos entre unidades, silenciosa, que no se ve leyendo el código. La PAID lo
detectó con una prueba que fuerza la reutilización; aquí la repite
`pruebas/test_rls.py`.

Las políticas están escritas para FALLAR CERRADAS: sin contexto, no se ve
nada. Por eso las órdenes de administración (sembrar, importar) tienen que
pedir expresamente el contexto de sistema.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from django.db import connection, transaction

RUTA_SISTEMA = "/"


def establecer_contexto(ruta_unidad: str, id_usuario: int | None) -> None:
    """Fija el contexto DENTRO de la transacción en curso."""
    if not connection.in_atomic_block:
        # Fuera de una transacción, `is_local` no tendría efecto útil: el valor
        # se perdería en la sentencia siguiente (autocommit) y RLS no vería nada.
        raise RuntimeError("El contexto de RLS solo se fija dentro de transaction.atomic().")
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('app.ruta_unidad', %s, true),"
            " set_config('app.id_usuario', %s, true)",
            [ruta_unidad, "" if id_usuario is None else str(id_usuario)],
        )


@contextmanager
def contexto_de_sistema(id_usuario: int | None = None) -> Iterator[None]:
    """
    Para órdenes de administración y tareas internas: ve toda la jerarquía.
    Nunca se usa para atender una petición de un usuario.
    """
    with transaction.atomic():
        establecer_contexto(RUTA_SISTEMA, id_usuario)
        yield


@contextmanager
def contexto_de_usuario(ruta_unidad: str, id_usuario: int) -> Iterator[None]:
    with transaction.atomic():
        establecer_contexto(ruta_unidad, id_usuario)
        yield
