/**
 * Iconos como SVG en línea.
 *
 * Sin biblioteca de iconos, y no por austeridad: A.2.1 prohíbe internet en
 * tiempo de ejecución, así que una fuente de iconos remota está descartada, y
 * un paquete de iconos completo son cientos de kilobytes transportados a una
 * red cerrada para usar quince. Estos quince se dibujan a mano, heredan
 * `currentColor` y escalan con la letra.
 *
 * Todos llevan `aria-hidden`: el significado lo da el texto que acompaña, no
 * el icono. Un icono con `aria-label` duplicaría el anuncio del lector.
 */

type Props = { readonly tamano?: number; readonly className?: string };

function base(tamano: number, className?: string) {
  return {
    width: tamano,
    height: tamano,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...(className !== undefined ? { className } : {}),
  };
}

export const Ancla = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2V21M5 13a7 7 0 0 0 14 0M4 13h2M18 13h2" />
  </svg>
);

export const Brujula = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.2 8.8-2 5.4-5.4 2 2-5.4z" />
  </svg>
);

export const Personas = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.4 5.2a3.2 3.2 0 0 1 0 5.6" />
  </svg>
);

export const Manos = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M13 11V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7H8a5 5 0 0 1-5-5v-3a1.5 1.5 0 0 1 3 0" />
  </svg>
);

export const Edificio = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M4 21V6l7-3 7 3v15M4 21h16" />
    <path d="M9 21v-5h4v5M8.5 10h1M13 10h1M8.5 13h1M13 13h1" />
  </svg>
);

export const Megafono = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z" />
    <path d="M17 9a4.5 4.5 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
  </svg>
);

export const Libro = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5Z" />
  </svg>
);

export const Herramienta = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M14.5 6.5a3.5 3.5 0 1 0 3 3l3.5 3.5-2.5 2.5L15 12a3.5 3.5 0 0 1-.5-5.5Z" />
    <path d="m9.5 10.5-6 6a2 2 0 0 0 2.8 2.8l6-6" />
  </svg>
);

export const Reloj = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const Salir = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </svg>
);

export const Contraste = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18a9 9 0 0 0 0-18Z" fill="currentColor" stroke="none" />
  </svg>
);

export const Letra = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M4 19 9.5 5l5.5 14M6 14.5h7" />
    <path d="M16.5 19 19 12l2.5 7M17.6 16.6h2.8" />
  </svg>
);

export const Marca = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="m5 12.8 4.4 4.2L19 7" />
  </svg>
);

export const Cruz = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const Alerta = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M12 4.5 2.8 20h18.4Z" />
    <path d="M12 10v4.2M12 17.2h.01" />
  </svg>
);

export const Info = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8h.01" />
  </svg>
);

export const Mas = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Descargar = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 17.5v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
  </svg>
);

export const Adjuntar = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M20 11.5l-7.6 7.6a4.5 4.5 0 0 1-6.4-6.4l7.7-7.7a3 3 0 0 1 4.3 4.3l-7.7 7.7a1.5 1.5 0 0 1-2.2-2.2l7-7" />
  </svg>
);

export const Mapa = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5Z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </svg>
);

export const Lupa = ({ tamano = 20, className }: Props) => (
  <svg {...base(tamano, className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);
