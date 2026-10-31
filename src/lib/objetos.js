import { COLOR, estiloTexto } from './estilo.js';
import { sombra, sombraRect } from './sombras.js';

// Objetos dibujados con formas simples (estilo plano como Kenney).

export function herramienta(scene, x, y, tipo) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x8b5e3c, 1).fillRoundedRect(-6, -90, 12, 150, 5);
  if (tipo === 'trapero') {
    g.fillStyle(0x2b6cb0, 1).fillRoundedRect(-30, 48, 60, 16, 4);
    for (let i = -6; i <= 6; i++) {
      const x = i * 6;
      g.lineStyle(7, 0x94a3b8, 1).lineBetween(x * 0.8, 60, x * 1.5, 112);
      g.lineStyle(3, 0xe2e8f0, 1).lineBetween(x * 0.8, 60, x * 1.5, 110);
    }
  } else if (tipo === 'escoba') {
    g.fillStyle(COLOR.rojo, 1).fillRect(-34, 50, 68, 16);
    g.fillStyle(0xf6c343, 1).fillTriangle(-34, 66, 34, 66, 0, 66).fillRect(-34, 66, 68, 34);
    g.lineStyle(2, 0xc8961e, 1);
    for (let i = -28; i <= 28; i += 8) g.lineBetween(i, 70, i, 100);
  } else if (tipo === 'plumero') {
    g.clear();
    g.fillStyle(0x8b5e3c, 1).fillRoundedRect(-6, -10, 12, 110, 5);
    const colores = [0xf687b3, 0x9f7aea, 0x63b3ed, 0xf6ad55, 0x68d391];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.fillStyle(colores[i % colores.length], 1).fillCircle(Math.cos(a) * 26, -40 + Math.sin(a) * 34, 18);
    }
  }
  c.add(g);
  return c;
}

export function letreroPisoMojado(scene, x, y) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0xb7791f, 1).fillTriangle(-58, 70, 58, 70, 0, -80);
  g.fillStyle(COLOR.amarillo, 1).fillTriangle(-50, 64, 50, 64, 0, -68);
  c.add([g,
    scene.add.image(0, -8, 'ui_warning').setDisplaySize(44, 44).setTint(0x1f2d3a),
    scene.add.text(0, 40, 'PISO\nMOJADO', estiloTexto(13, '#1f2d3a', { align: 'center' })).setOrigin(0.5)]);
  return c;
}

export function basurero(scene, x, y) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2f4f4f, 1).fillRoundedRect(-62, -78, 124, 20, 8);
  g.fillStyle(0x3d6b6b, 1).fillRoundedRect(-54, -58, 108, 140, { tl: 0, tr: 0, bl: 14, br: 14 });
  g.lineStyle(4, 0x2f4f4f, 1);
  for (const lx of [-24, 0, 24]) g.lineBetween(lx, -40, lx, 64);
  c.add([g, scene.add.image(0, 10, 'ui_trashcan').setDisplaySize(50, 50).setAlpha(0.9)]);
  return c;
}

export function canasto(scene, x, y, texto, color = COLOR.rojo) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(color, 1).fillRoundedRect(-90, -50, 180, 100, 14);
  g.lineStyle(4, 0xffffff, 0.5);
  for (let i = -70; i <= 70; i += 20) g.lineBetween(i, -40, i, 40);
  g.fillStyle(0x000000, 0.25).fillRoundedRect(-90, -50, 180, 18, { tl: 14, tr: 14, bl: 0, br: 0 });
  c.add([g, scene.add.text(0, 0, texto, estiloTexto(22, '#ffffff', { stroke: '#000000', strokeThickness: 4 })).setOrigin(0.5)]);
  return c;
}

// Tarjeta tocable para elegir un objeto.
export function tarjeta(scene, x, y, w, h) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  sombraRect(g, -w / 2 + 2, -h / 2 + 8, w, h, 18, 0.22);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.lineStyle(4, 0xb8c4cf, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  c.add(g);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  return c;
}

// Carro de reposición: canasta de alambre con manilla y ruedas (para productos que hay que devolver).
export function carroReposicion(scene, x, y) {
  const c = scene.add.container(x, y);
  c.add(sombra(scene, 0, 78, 250, 34, 0.3));
  const g = scene.add.graphics();
  // Canasta
  g.fillStyle(0x553c9a, 0.18).fillRoundedRect(-95, -80, 190, 90, 10);
  g.lineStyle(5, 0x553c9a, 1).strokeRoundedRect(-95, -80, 190, 90, 10);
  g.lineStyle(2, 0x6b46c1, 0.8);
  for (let k = -70; k <= 70; k += 28) g.lineBetween(k, -78, k, 8);
  g.lineBetween(-93, -50, 93, -50).lineBetween(-93, -20, 93, -20);
  // Manilla y estructura
  g.lineStyle(6, 0x4a5568, 1).lineBetween(95, -80, 125, -110).lineBetween(-80, 10, -80, 56).lineBetween(80, 10, 80, 56);
  g.lineStyle(8, 0x38b2ac, 1).lineBetween(115, -112, 140, -112);
  g.lineStyle(5, 0x4a5568, 1).lineBetween(-90, 56, 90, 56);
  // Ruedas
  g.fillStyle(0x1a202c, 1).fillCircle(-70, 66, 12).fillCircle(70, 66, 12);
  g.fillStyle(0xa0aec0, 1).fillCircle(-70, 66, 5).fillCircle(70, 66, 5);
  c.add(g);
  return c;
}

// Bebida derramada en el piso (vista en perspectiva): contorno irregular de líquido, más oscuro en el
// borde y translúcido al centro, con brillos de las lámparas, gotas sueltas y un hilo hacia la derecha
// (donde queda la botella). Se dibuja una vez en un canvas; `ancho` en px del juego.
const CHARCO = { w: 480, h: 170 };

function contorno(ctx, cx, cy, rx, ry, ondas) {
  const n = 72;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = ondas.reduce((r, [k, a, f]) => r + a * Math.sin(k * t + f), 1);
    pts.push([cx + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r]);
  }
  // Curva suave que pasa por los puntos medios (sin esquinas).
  const medio = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  ctx.moveTo(...medio(pts[n - 1], pts[0]));
  pts.forEach((p, i) => ctx.quadraticCurveTo(p[0], p[1], ...medio(p, pts[(i + 1) % n])));
  ctx.closePath();
}

function texturaCharco(scene) {
  if (scene.textures.exists('charco')) return;
  const { w, h } = CHARCO;
  const lienzo = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
  };
  // El líquido se pinta opaco en un canvas aparte y se pega translúcido: así las partes que se
  // superponen (charco, hilo) no marcan bordes por dentro.
  const [liq, ctx] = lienzo();
  const forma = () => {
    ctx.beginPath();
    contorno(ctx, 205, 88, 175, 54, [[2, 0.07, 0.4], [3, 0.11, 1.9], [5, 0.06, 0.2], [7, 0.035, 2.6], [11, 0.015, 1.1]]);
    contorno(ctx, 375, 74, 62, 20, [[2, 0.1, 1.2], [3, 0.12, 0.3], [6, 0.05, 2]]);   // hilo hacia la botella
    contorno(ctx, 452, 68, 18, 8, [[3, 0.15, 0.7]]);
  };
  // Borde más oscuro (el líquido se acumula en la orilla) y centro más claro (se ve el piso).
  forma();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgb(66, 24, 6)';
  ctx.stroke();
  const g = ctx.createRadialGradient(205, 80, 10, 205, 88, 200);
  g.addColorStop(0, 'rgb(168, 86, 38)');
  g.addColorStop(0.7, 'rgb(126, 56, 20)');
  g.addColorStop(1, 'rgb(92, 36, 10)');
  ctx.fillStyle = g;
  ctx.fill();
  // Brillos de las lámparas del techo, dentro del charco.
  ctx.save();
  forma();
  ctx.clip();
  const brillo = (x, y, rx, ry, a) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const b = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    b.addColorStop(0, `rgba(255, 250, 240, ${a})`);
    b.addColorStop(1, 'rgba(255, 250, 240, 0)');
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  brillo(150, 66, 70, 11, 0.6);
  brillo(268, 96, 46, 8, 0.4);
  brillo(372, 70, 26, 5, 0.45);
  brillo(140, 64, 18, 3, 0.95);
  ctx.restore();
  // Gotas sueltas alrededor.
  for (const [x, y, r] of [[22, 112, 7], [44, 132, 4], [330, 140, 6], [362, 124, 3.5], [96, 30, 5], [300, 22, 4], [420, 100, 4]]) {
    ctx.beginPath();
    contorno(ctx, x, y, r * 1.5, r, [[3, 0.12, x]]);
    ctx.fillStyle = 'rgb(96, 40, 12)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.8)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y - r * 0.3, r * 0.5, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const [c, final] = lienzo();
  final.globalAlpha = 0.8;
  final.drawImage(liq, 0, 0);
  scene.textures.addCanvas('charco', c);
}

// El centro del charco principal queda en (x, y); la botella va a la derecha, a ~0,5·ancho.
export function charco(scene, x, y, ancho) {
  texturaCharco(scene);
  const k = ancho / CHARCO.w;
  return scene.add.image(x + (CHARCO.w / 2 - 205) * k, y, 'charco').setScale(k);
}
