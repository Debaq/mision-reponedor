// Sombras suaves, hechas al cargar con degradados en un canvas (sin filtros, para que funcionen en
// todos los navegadores): una mancha difusa ('sombra') para personajes y carros, y una sombra de
// contacto horneada bajo cada producto, para que no floten sobre repisas, cajas y carros.

// Mancha elíptica: oscura al centro y que se desvanece hacia el borde. Se estira con setDisplaySize.
function mancha(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext('2d');
  ctx.translate(ancho / 2, alto / 2);
  ctx.scale(ancho / 2, alto / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// Al arrastrar, el objeto se ve levantado: pierde la sombra de contacto y deja una sombra difusa
// más abajo, que lo sigue. Al soltarlo, la sombra se recoge. Llamar después de los otros 'dragstart'
// del objeto (usa su profundidad). Sirve para imágenes y contenedores.
export function levantar(obj) {
  const scene = obj.scene;
  let s = null;
  let abajo = 0;
  const imagenes = () => (obj.list || [obj]).filter((o) => o.texture);
  obj.on('dragstart', () => {
    for (const o of imagenes()) if (scene.textures.exists(o.texture.key + '_limpio')) o.setTexture(o.texture.key + '_limpio');
    const b = obj.getBounds();
    abajo = b.bottom - obj.y + 26;
    s?.destroy();
    s = sombra(scene, obj.x + 12, obj.y + abajo, b.width * 0.9, b.width * 0.22, 0)
      .setDepth(obj.depth - 0.5);
    scene.tweens.add({ targets: s, alpha: 0.28, duration: 120 });
  });
  obj.on('drag', (p, x, y) => s?.setPosition(x + 12, y + abajo));
  obj.on('dragend', () => {
    for (const o of imagenes()) if (o.texture.key.endsWith('_limpio')) o.setTexture(o.texture.key.slice(0, -7));
    const ultima = s;
    s = null;
    scene.tweens.add({ targets: ultima, alpha: 0, scaleX: ultima.scaleX * 0.5, scaleY: ultima.scaleY * 0.5, y: ultima.y - abajo / 2, duration: 140, onComplete: () => ultima.destroy() });
  });
}

// Sombra de borde difuso para paneles, tarjetas y botones (en un Graphics, antes de dibujar la
// forma): la misma figura en capas tenues, cada una un poco más grande. (x, y, w, h) es el rectángulo
// de la sombra; `difuso` es cuánto se desvanece el borde, en px.
const CAPAS = 6;
const alfaCapa = (alfa) => 1 - (1 - alfa) ** (1 / CAPAS);
const crece = (difuso, i) => difuso * (i / (CAPAS - 1) - 0.4);

export function sombraRect(g, x, y, w, h, radio = 16, alfa = 0.2, difuso = 12) {
  g.fillStyle(0x000000, alfaCapa(alfa));
  for (let i = 0; i < CAPAS; i++) {
    const e = crece(difuso, i);
    const [ww, hh] = [w + 2 * e, h + 2 * e];
    g.fillRoundedRect(x - e, y - e, ww, hh, Math.max(0, Math.min(radio + e, ww / 2, hh / 2)));
  }
  return g;
}

export function sombraCirculo(g, x, y, r, alfa = 0.2, difuso = 12) {
  g.fillStyle(0x000000, alfaCapa(alfa));
  for (let i = 0; i < CAPAS; i++) g.fillCircle(x, y, r + crece(difuso, i));
  return g;
}

// Igual, para un polígono: cada capa estira la figura `e` px por lado desde su centro.
export function sombraPuntos(g, puntos, alfa = 0.2, difuso = 12) {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [cx, cy, mw, mh] = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2];
  g.fillStyle(0x000000, alfaCapa(alfa));
  for (let i = 0; i < CAPAS; i++) {
    const e = crece(difuso, i);
    g.fillPoints(puntos.map((p) => ({ x: cx + ((p.x - cx) * (mw + e)) / mw, y: cy + ((p.y - cy) * (mh + e)) / mh })), true);
  }
  return g;
}

// Sombra difusa bajo algo apoyado en el piso, centrada en (x, y).
export function sombra(scene, x, y, ancho, alto, alfa = 0.3) {
  return scene.add.image(x, y, 'sombra').setDisplaySize(ancho, alto).setAlpha(alfa);
}

// Redibuja la textura del producto con una sombra bajo su base (lo que toca la superficie).
function sombrearProducto(scene, clave) {
  const img = scene.textures.get(clave).getSourceImage();
  const { width: w, height: h } = img;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const lleno = (x, y) => px[(y * w + x) * 4 + 3] > 40;
  let base = h - 1;
  while (base > 0 && ![...Array(w).keys()].some((x) => lleno(x, base))) base--;
  // Ancho de la base: lo que hay en las filas más bajas.
  let x0 = w;
  let x1 = 0;
  for (let y = Math.max(0, base - Math.round(h * 0.08)); y <= base; y++) {
    for (let x = 0; x < w; x++) {
      if (!lleno(x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  if (x1 <= x0) return;
  const rx = ((x1 - x0) / 2) * 1.2;
  const ry = Math.max(5, Math.min(rx * 0.22, 10));
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 0.65;
  ctx.drawImage(mancha(64, 16), (x0 + x1) / 2 - rx, base + 1 - ry, rx * 2, ry * 2);
  ctx.globalAlpha = 1;
  ctx.drawImage(img, 0, 0);
  // Sin la sombra de contacto, para cuando el producto va levantado (ver levantar).
  scene.textures.addImage(clave + '_limpio', img);
  scene.textures.remove(clave);
  scene.textures.addCanvas(clave, c);
}

export function crearSombras(scene) {
  scene.textures.addCanvas('sombra', mancha(128, 32));
  for (const clave of scene.textures.getTextureKeys()) if (/^(prod|basura)_/.test(clave)) sombrearProducto(scene, clave);
}
