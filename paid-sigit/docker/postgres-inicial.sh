#!/bin/sh
# Se ejecuta una sola vez, al crear el volumen de PostgreSQL: crea los dos roles.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE sigit_propietario LOGIN PASSWORD '${SIGIT_CLAVE_PROPIETARIO}' NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
CREATE ROLE sigit_app LOGIN PASSWORD '${SIGIT_CLAVE_APP}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE paid_sigit OWNER sigit_propietario;
GRANT CONNECT ON DATABASE paid_sigit TO sigit_app;
SQL
