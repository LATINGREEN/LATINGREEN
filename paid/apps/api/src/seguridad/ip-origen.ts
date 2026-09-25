/**
 * La IP de origen real de una petición que llega a través de proxies.
 *
 * Cada proxy AÑADE al final de `X-Forwarded-For` la dirección desde la que le
 * llegó la petición (`$proxy_add_x_forwarded_for` en nginx). Lo que viene
 * antes lo escribió el cliente y puede ser falso: desde internet cualquiera
 * manda `X-Forwarded-For: 10.0.0.1`. Por eso no se toma la PRIMERA entrada,
 * sino la que añadió el proxy de confianza más externo: contando desde el
 * final, la número `proxiesDeConfianza`.
 *
 *   cliente ──▶ nginx (1) ──▶ API                      proxiesDeConfianza = 1
 *   cliente ──▶ proxy del VPS ──▶ nginx ──▶ API         proxiesDeConfianza = 2
 *
 * Con `0` la cabecera se ignora y vale la dirección del socket.
 */
export function ipDeOrigen(
  cabeceraReenviada: string | string[] | undefined,
  ipDelSocket: string | undefined,
  proxiesDeConfianza: number,
): string {
  const reenviada = Array.isArray(cabeceraReenviada)
    ? cabeceraReenviada.join(',')
    : (cabeceraReenviada ?? '');
  const entradas = reenviada
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e !== '');

  if (proxiesDeConfianza > 0 && entradas.length > 0) {
    // Si hay menos entradas que proxies, la más antigua es la mejor que hay:
    // la escribió un proxy de confianza, no el cliente.
    const indice = Math.max(0, entradas.length - proxiesDeConfianza);
    const elegida = entradas[indice];
    if (elegida !== undefined) return sinPrefijoIpv4(elegida);
  }
  return sinPrefijoIpv4(ipDelSocket ?? '0.0.0.0');
}

/**
 * Express entrega las IPv4 mapeadas como `::ffff:10.0.0.1`, y el tipo `inet`
 * de PostgreSQL no las compara contra un CIDR IPv4.
 */
function sinPrefijoIpv4(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
