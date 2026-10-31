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
  scene.textures.remove(clave);
  scene.textures.addCanvas(clave, c);
}

export function crearSombras(scene) {
  scene.textures.addCanvas('sombra', mancha(128, 32));
  for (const clave of scene.textures.getTextureKeys()) if (/^(prod|basura)_/.test(clave)) sombrearProducto(scene, clave);
}
