export const ANCHO = 1280;
export const ALTO = 720;

export const FUENTE = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export const COLOR = {
  // Identidad del supermercado ficticio "El Barrio": violeta + turquesa
  // (evita colores de cadenas reales: verde/amarillo, azul/amarillo, rojo).
  marca: 0x553c9a,
  marcaAcento: 0x38b2ac,
  verde: 0x2f855a,
  verdeClaro: 0x48bb78,
  rojo: 0xc53030,
  amarillo: 0xf6c343,
  azul: 0x2b6cb0,
  gris: 0x4a5568,
  blanco: 0xffffff,
  oscuro: 0x1f2d3a,
  papel: 0xfdf8ec,
  carton: 0xc89b62,
  cartonOscuro: 0x9c7442,
};

export function estiloTexto(tam = 28, color = '#1f2d3a', extra = {}) {
  return { fontFamily: FUENTE, fontSize: `${tam}px`, color, fontStyle: 'bold', ...extra };
}
