from django.apps import AppConfig


class ProteccionConfig(AppConfig):
    """Sin modelos: solo las migraciones de seguridad de la base (RLS, bitácora, privilegios)."""

    name = "sigit.proteccion"
    label = "proteccion"
    verbose_name = "Protección de datos"
