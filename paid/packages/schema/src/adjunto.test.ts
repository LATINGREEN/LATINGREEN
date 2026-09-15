import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_ADJUNTO,
  CUOTA_BYTES_POR_ACTIVIDAD,
  EXTENSIONES_POR_CATEGORIA,
  cabeEnLaCuota,
  calcularCuota,
  categoriaDeExtension,
  extensionDe,
  extensionPermitida,
  mimeCoincideConExtension,
} from './adjunto';

const MB = 1024 * 1024;

describe('R11 — cuota de 10 MB AGREGADA, no por archivo', () => {
  it('la cuota son 10485760 bytes', () => {
    expect(CUOTA_BYTES_POR_ACTIVIDAD).toBe(10485760);
  });

  it('un archivo de 9 MB cabe en una actividad vacia', () => {
    expect(cabeEnLaCuota([], 9 * MB)).toBe(true);
  });

  it('9 MB + 2 MB en la MISMA actividad no caben (es el caso de la Puerta 1)', () => {
    expect(cabeEnLaCuota([9 * MB], 2 * MB)).toBe(false);
  });

  it('9 MB + 1 MB caben exactamente', () => {
    expect(cabeEnLaCuota([9 * MB], 1 * MB)).toBe(true);
  });

  it('cuarenta archivos de 9 MB NO pasan: es justo el fallo del anti-patron P5', () => {
    const vigentes = Array.from({ length: 39 }, () => 9 * MB);
    expect(cabeEnLaCuota(vigentes, 9 * MB)).toBe(false);
  });

  it('informa el consumo acumulado antes de subir', () => {
    const estado = calcularCuota([5 * MB]);
    expect(estado.bytesUsados).toBe(5 * MB);
    expect(estado.bytesDisponibles).toBe(5 * MB);
    expect(estado.porcentajeUsado).toBe(50);
  });

  it('nunca reporta disponible negativo', () => {
    expect(calcularCuota([20 * MB]).bytesDisponibles).toBe(0);
  });
});

describe('R12 — extensiones por categoria', () => {
  it('las cuatro categorias del manual', () => {
    expect([...CATEGORIAS_ADJUNTO]).toEqual(['IMAGEN', 'DOCUMENTO', 'AUDIO', 'VIDEO']);
  });

  it('IMAGEN: jpg, png, gif, jpeg', () => {
    expect([...EXTENSIONES_POR_CATEGORIA.IMAGEN]).toEqual(['jpg', 'png', 'gif', 'jpeg']);
  });

  it('DOCUMENTO: pdf, doc, docx, xls, xlsx, ppt, pptx', () => {
    expect([...EXTENSIONES_POR_CATEGORIA.DOCUMENTO]).toEqual([
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
    ]);
  });

  it('AUDIO: mp3, wma', () => {
    expect([...EXTENSIONES_POR_CATEGORIA.AUDIO]).toEqual(['mp3', 'wma']);
  });

  it('VIDEO: mp4, wmv, avi', () => {
    expect([...EXTENSIONES_POR_CATEGORIA.VIDEO]).toEqual(['mp4', 'wmv', 'avi']);
  });

  it('clasifica por extension', () => {
    expect(categoriaDeExtension('JPG')).toBe('IMAGEN');
    expect(categoriaDeExtension('xlsx')).toBe('DOCUMENTO');
    expect(categoriaDeExtension('wma')).toBe('AUDIO');
    expect(categoriaDeExtension('avi')).toBe('VIDEO');
  });

  it('rechaza extensiones fuera de las cuatro categorias', () => {
    for (const ext of ['exe', 'sh', 'zip', 'svg', 'webp', 'mkv', 'odt']) {
      expect(extensionPermitida(ext)).toBe(false);
      expect(categoriaDeExtension(ext)).toBeNull();
    }
  });

  it('extrae la extension del nombre', () => {
    expect(extensionDe('informe final.PDF')).toBe('pdf');
    expect(extensionDe('foto.2026.jpeg')).toBe('jpeg');
    expect(extensionDe('sin_extension')).toBe('');
    expect(extensionDe('termina_en_punto.')).toBe('');
  });
});

describe('R12 — el contenido real manda sobre la extension declarada', () => {
  it('acepta un jpg que de verdad es image/jpeg', () => {
    expect(mimeCoincideConExtension('jpg', 'image/jpeg')).toBe(true);
  });

  it('RECHAZA un ejecutable renombrado a .jpg', () => {
    expect(mimeCoincideConExtension('jpg', 'application/x-msdownload')).toBe(false);
  });

  it('RECHAZA un .pdf que en realidad es un zip', () => {
    expect(mimeCoincideConExtension('pdf', 'application/zip')).toBe(false);
  });

  it('rechaza extensiones que no estan en el catalogo', () => {
    expect(mimeCoincideConExtension('exe', 'application/x-msdownload')).toBe(false);
  });
});
