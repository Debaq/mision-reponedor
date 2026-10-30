import { COLOR, estiloTexto } from './estilo.js';

// Góndola de tres secciones (una por producto), con dos repisas cada una.
// items: [{ p, faltan }]: `faltan` deja huecos (marcos vacíos) al final de la repisa de arriba.
// centros: posición x de cada sección (para dejar espacio a un panel a la izquierda).
// Devuelve las secciones con su geometría: { p, x, x0, x1, arriba, abajo, etiqueta: {x, y}, huecos: [{x, y}] }.
export const GONDOLA = { centros: [260, 560, 860], ancho: 280, repisas: [270, 450], porFila: 4, paso: 62, tam: 56 };

export function gondola(scene, items, centros = GONDOLA.centros) {
  const { ancho, repisas, porFila, paso, tam } = GONDOLA;
  const x0 = centros[0] - ancho / 2 - 20;
  const x1 = centros[centros.length - 1] + ancho / 2 + 20;
  const g = scene.add.graphics();
  g.fillStyle(0x5f6b78, 1).fillRect(x0 - 14, 100, 14, 380).fillRect(x1, 100, 14, 380);
  g.fillStyle(0xdfe6ec, 1).fillRect(x0, 100, x1 - x0, 380);
  for (const b of repisas) g.fillStyle(0x8795a1, 1).fillRect(x0 - 14, b, x1 - x0 + 28, 14);

  return items.map((it, i) => {
    const x = centros[i];
    const sec = { p: it.p, x, x0: x - ancho / 2, x1: x + ancho / 2, arriba: 100, abajo: repisas[1] + 14,
      etiqueta: { x, y: repisas[1] + 40 }, huecos: [] };
    repisas.forEach((base, fila) => {
      for (let k = 0; k < porFila; k++) {
        const sx = x - ((porFila - 1) * paso) / 2 + k * paso;
        const sy = base - tam / 2 - 2;
        if (fila === 0 && k >= porFila - (it.faltan || 0)) {
          g.lineStyle(3, 0x9fb0bf, 1).strokeRoundedRect(sx - 26, sy - 30, 52, 60, 8);
          sec.huecos.push({ x: sx, y: sy });
        } else {
          scene.add.image(sx, sy, 'prod_' + it.p).setDisplaySize(tam, tam);
        }
      }
    });
    return sec;
  });
}

// Etiqueta de precio: dibujo del producto, precio y código de barras.
// nueva: amarilla; vieja: gris (precio anterior).
export function etiquetaPrecio(scene, x, y, p, precio, nueva = true) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(nueva ? COLOR.amarillo : 0xcbd5e0, 1).fillRoundedRect(-66, -28, 132, 56, 8);
  g.lineStyle(2, nueva ? 0xb7791f : 0x8795a1, 1).strokeRoundedRect(-66, -28, 132, 56, 8);
  // código de barras
  g.fillStyle(0x1f2d3a, 1);
  [0, 3, 5, 9, 11, 14, 18, 20, 23, 27, 29, 32].forEach((dx, k) => g.fillRect(-4 + dx * 1.8, 12, k % 3 ? 2 : 3, 11));
  c.add([g, scene.add.image(-40, 0, 'prod_' + p).setDisplaySize(40, 40),
    scene.add.text(26, -9, precio, estiloTexto(18, nueva ? '#1f2d3a' : '#4a5568')).setOrigin(0.5)]);
  c.setSize(132, 56);
  return c;
}
