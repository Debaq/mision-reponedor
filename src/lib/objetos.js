import { COLOR, estiloTexto } from './estilo.js';

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
  g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 18);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.lineStyle(4, 0xb8c4cf, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  c.add(g);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  return c;
}
