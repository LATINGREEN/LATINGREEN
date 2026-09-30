"""
`python manage.py comprobar_rol_bd` — se niega a seguir si el rol con que se
conecta la aplicación salta la RLS.

Un superusuario o un rol con BYPASSRLS ve todas las unidades sin ningún error:
el aislamiento desaparecería en silencio. En Docker la aplicación usa
`sigit_app`; en un proveedor que da un solo rol (Render), ese rol es el dueño,
y FORCE ROW LEVEL SECURITY lo somete a las políticas mientras no sea
superusuario ni tenga BYPASSRLS. Esta orden lo comprueba antes de atender.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import connection


def rol_actual() -> tuple[str, bool, bool]:
    """Nombre del rol conectado, si es superusuario y si tiene BYPASSRLS."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
        )
        return cursor.fetchone()


class Command(BaseCommand):
    help = "Falla si el rol de la base de datos es superusuario o tiene BYPASSRLS."

    def handle(self, *args: object, **opciones: object) -> None:
        nombre, superusuario, salta_rls = rol_actual()
        if superusuario or salta_rls:
            raise CommandError(
                f"El rol {nombre} salta la RLS (superusuario o BYPASSRLS): "
                "cada unidad vería los datos de todas. Use un rol sin esos atributos."
            )
        self.stdout.write(f"Rol {nombre}: sujeto a RLS.")
