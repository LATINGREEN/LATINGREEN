#!/bin/bash
# Usuario de la aplicacion, distinto del superusuario.
#
# Importa para dos reglas:
#
#   R14 — el privilegio DELETE se revoca salvo para el rol administrador. Con
#         un solo superusuario no hay nada que revocar.
#   R6  — las politicas RLS se aplican a este usuario. Un superusuario las
#         ignora por definicion (BYPASSRLS implicito), asi que si la aplicacion
#         se conecta como superusuario, RLS no protege nada y el test de la
#         Puerta 1 pasaria en falso.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PAID_APP_USER}') THEN
      CREATE ROLE ${PAID_APP_USER} LOGIN PASSWORD '${PAID_APP_PASSWORD}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${PAID_APP_USER};
SQL

echo "Usuario de aplicacion ${PAID_APP_USER} listo (NOBYPASSRLS)."
