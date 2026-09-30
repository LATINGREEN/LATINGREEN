"""
Row Level Security, bitácora y privilegios.

AISLAMIENTO POR UNIDAD: cada unidad ve lo suyo y lo de sus subordinadas; JACID,
en la raíz de la jerarquía, ve todo. Lo decide la BASE DE DATOS, no la vista:
un filtro olvidado en una consulta no puede filtrar datos de otra unidad.

- FORCE ROW LEVEL SECURITY: las políticas aplican también al dueño de las
  tablas. Así las pruebas, que corren con el rol dueño, ejercitan las mismas
  políticas que producción.
- Las políticas FALLAN CERRADAS: sin contexto no se ve ni se escribe nada.
- Excepción deliberada: las ENTIDADES se leen desde cualquier unidad (se
  escriben solo en la propia). Una alcaldía es la misma para todos, y si cada
  unidad solo viera las suyas registraría la misma alcaldía otra vez: es la
  duplicidad que la plataforma tiene que evitar. Ver D-S05.

El rol de la aplicación (SIGIT_ROL_APLICACION, `sigit_app` por omisión) tiene
que ser NOSUPERUSER NOBYPASSRLS: un superusuario ignora RLS por definición.
"""

import os
import re

from django.core.exceptions import ImproperlyConfigured
from django.db import migrations

ROL_APP = os.environ.get("SIGIT_ROL_APLICACION", "sigit_app")
# El nombre del rol se interpola en SQL (GRANT no admite parámetros): se
# valida como identificador antes de usarlo. Las tablas son constantes de
# este archivo, no entrada de nadie.
if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", ROL_APP):
    raise ImproperlyConfigured("SIGIT_ROL_APLICACION no es un identificador válido de PostgreSQL.")

POR_UNIDAD = {
    "maestros_personal": "unidad_id",
    "maestros_herramientaaid": "unidad_id",
    "jornadas_jornada": "unidad_id",
    "analitica_medicionindicador": "unidad_id",
    "integracion_registroexterno": "unidad_propuesta_id",
}
PESTANAS = [
    "jornadas_jornadatipooperacion",
    "jornadas_jornadaentidadservicio",
    "jornadas_jornadaservicioprestado",
    "jornadas_jornadapoblacion",
    "jornadas_jornadaentidadapoyada",
    "jornadas_jornadamediodifusion",
    "jornadas_jornadamedioutilizado",
    "jornadas_jornadarecurso",
    "jornadas_jornadabiendonado",
    "jornadas_jornadaresumen",
    "jornadas_adjunto",
]
AUDITADAS = [
    "maestros_personal",
    "maestros_entidad",
    "maestros_herramientaaid",
    "jornadas_jornada",
]
CON_BITACORA = [
    *AUDITADAS,
    *PESTANAS,
    "analitica_medicionindicador",
    "analitica_indicadorimpacto",
    "integracion_registroexterno",
    "integracion_sistemaexterno",
    "nucleo_usuario",
]
# Sin DELETE para la aplicación: el borrado es lógico.
SIN_BORRADO = [*AUDITADAS, "integracion_registroexterno", "nucleo_unidad"]


def _subida() -> str:
    sql: list[str] = []
    for tabla, columna in POR_UNIDAD.items():
        sql += [
            f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY;",
            f"ALTER TABLE {tabla} FORCE ROW LEVEL SECURITY;",
            f"CREATE POLICY ambito_unidad ON {tabla} FOR ALL "
            f"USING (sigit_ve_unidad({columna})) WITH CHECK (sigit_ve_unidad({columna}));",
        ]
    for tabla in PESTANAS:
        # Las tablas son constantes de este archivo, no entrada de nadie.
        condicion = "EXISTS (SELECT 1 FROM jornadas_jornada j WHERE j.id = TABLA.jornada_id)"
        condicion = condicion.replace("TABLA", tabla)
        sql += [
            f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY;",
            f"ALTER TABLE {tabla} FORCE ROW LEVEL SECURITY;",
            f"CREATE POLICY ambito_jornada ON {tabla} FOR ALL "
            f"USING ({condicion}) WITH CHECK ({condicion});",
        ]
    sql += [
        "ALTER TABLE maestros_entidad ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE maestros_entidad FORCE ROW LEVEL SECURITY;",
        "CREATE POLICY entidad_lectura ON maestros_entidad FOR SELECT USING (sigit_hay_contexto());",
        "CREATE POLICY entidad_alta ON maestros_entidad FOR INSERT "
        "WITH CHECK (sigit_ve_unidad(unidad_id));",
        "CREATE POLICY entidad_cambio ON maestros_entidad FOR UPDATE "
        "USING (sigit_ve_unidad(unidad_id)) WITH CHECK (sigit_ve_unidad(unidad_id));",
        # Índice de trigramas para buscar entidades semejantes antes de crear una.
        "CREATE INDEX entidad_nombre_trigramas ON maestros_entidad "
        "USING gin (nombre_normalizado gin_trgm_ops);",
        "CREATE INDEX jornada_lugar_trigramas ON jornadas_jornada USING gin (lugar gin_trgm_ops);",
    ]
    for tabla in AUDITADAS:
        sql.append(
            f"CREATE TRIGGER auditoria BEFORE INSERT OR UPDATE ON {tabla} "
            "FOR EACH ROW EXECUTE FUNCTION sigit_fijar_auditoria();"
        )
    for tabla in CON_BITACORA:
        sql.append(
            f"CREATE TRIGGER bitacora AFTER INSERT OR UPDATE OR DELETE ON {tabla} "
            "FOR EACH ROW EXECUTE FUNCTION sigit_registrar_cambio();"
        )
    # Privilegios del rol de la aplicación, si existe (en pruebas puede no existir).
    sin_borrado = ", ".join(f"'{t}'" for t in SIN_BORRADO)
    sql.append(
        PRIVILEGIOS.replace("{ROL_APP}", ROL_APP).replace("{SIN_BORRADO}", sin_borrado)
    )
    return "\n".join(sql)


# Plantilla y no f-string: el rol (validado arriba) y las tablas (constantes)
# se sustituyen con replace, a la vista, en _subida().
PRIVILEGIOS = """
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{ROL_APP}') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO {ROL_APP}';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {ROL_APP}';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {ROL_APP}';
    FOREACH t IN ARRAY ARRAY[{SIN_BORRADO}] LOOP
      EXECUTE format('REVOKE DELETE ON %I FROM {ROL_APP}', t);
    END LOOP;
    -- La bitácora y los intentos de ingreso no se reescriben ni se borran. La
    -- bitácora ni siquiera se inserta a mano: solo el disparador escribe en ella.
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON nucleo_bitacora FROM {ROL_APP}';
    EXECUTE 'REVOKE UPDATE, DELETE ON nucleo_intentoingreso FROM {ROL_APP}';
    EXECUTE 'REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM {ROL_APP}';
  END IF;
END $$;
"""


def _bajada() -> str:
    sql: list[str] = [
        "DROP INDEX IF EXISTS entidad_nombre_trigramas;",
        "DROP INDEX IF EXISTS jornada_lugar_trigramas;",
    ]
    for tabla in CON_BITACORA:
        sql.append(f"DROP TRIGGER IF EXISTS bitacora ON {tabla};")
    for tabla in AUDITADAS:
        sql.append(f"DROP TRIGGER IF EXISTS auditoria ON {tabla};")
    for tabla in [*POR_UNIDAD, *PESTANAS, "maestros_entidad"]:
        sql += [
            f"DROP POLICY IF EXISTS ambito_unidad ON {tabla};",
            f"DROP POLICY IF EXISTS ambito_jornada ON {tabla};",
            f"ALTER TABLE {tabla} NO FORCE ROW LEVEL SECURITY;",
            f"ALTER TABLE {tabla} DISABLE ROW LEVEL SECURITY;",
        ]
    sql += [
        "DROP POLICY IF EXISTS entidad_lectura ON maestros_entidad;",
        "DROP POLICY IF EXISTS entidad_alta ON maestros_entidad;",
        "DROP POLICY IF EXISTS entidad_cambio ON maestros_entidad;",
    ]
    return "\n".join(sql)


class Migration(migrations.Migration):
    dependencies = [
        ("nucleo", "0002_funciones_base"),
        ("maestros", "0002_initial"),
        ("jornadas", "0002_initial"),
        ("integracion", "0002_initial"),
        ("analitica", "0002_initial"),
    ]
    operations = [migrations.RunSQL(_subida(), _bajada())]
