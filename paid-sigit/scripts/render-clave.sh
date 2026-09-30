# Render genera valores aleatorios de 256 bits (44 caracteres en base64) y la
# plataforma exige una clave de al menos 50: se unen dos valores generados.
if [ -z "${SIGIT_CLAVE_SECRETA:-}" ]; then
  SIGIT_CLAVE_SECRETA="${SIGIT_CLAVE_RENDER_1}${SIGIT_CLAVE_RENDER_2}"
  export SIGIT_CLAVE_SECRETA
fi
