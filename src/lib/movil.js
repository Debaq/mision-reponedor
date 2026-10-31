// Ajustes para celulares y tablets.
const VERTICAL_TACTIL = '(orientation: portrait) and (pointer: coarse)';

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches;

// Pantalla completa + bloqueo horizontal. Debe llamarse desde un toque del usuario.
// (Android lo permite; iPhone no, ahí queda el aviso "Gira tu celular" de index.html)
export function pantallaCompleta(scene) {
  if (!esTactil() || scene.scale.isFullscreen || !scene.scale.fullscreen.available) return;
  scene.scale.once('enterfullscreen', () => {
    screen.orientation?.lock?.('landscape').catch(() => {});
  });
  scene.scale.startFullscreen();
}

// Mientras el celular está en vertical (tapado por el aviso), el juego y el sonido se pausan.
export function pausarEnVertical(juego) {
  const mq = window.matchMedia(VERTICAL_TACTIL);
  const aplicar = () => {
    if (mq.matches) {
      juego.sound.pauseAll();
      juego.pause();
    } else {
      juego.resume();
      juego.sound.resumeAll();
    }
  };
  mq.addEventListener('change', aplicar);
  juego.events.once('ready', aplicar);
}

// Campo de texto HTML encima del canvas, en (x, y) del juego (centro) y de ancho × alto px del juego.
// Va siempre junto al canvas: en pantalla completa Phaser mueve el canvas a otro contenedor y solo se
// ve lo que está dentro (por eso el DOMElement de Phaser no aparecía en la tablet). La letra no baja
// de 16 px (si no, iOS hace zoom al escribir). Se quita solo al cerrar la escena.
export function campoTexto(scene, x, y, ancho, alto, atributos = {}) {
  const campo = Object.assign(document.createElement('input'), { className: 'campo', autocomplete: 'off' }, atributos);
  campo.setAttribute('autocapitalize', 'words');
  campo.setAttribute('autocorrect', 'off');
  campo.setAttribute('spellcheck', 'false');
  // Que el teclado no llegue a Phaser mientras se escribe.
  campo.addEventListener('keydown', (e) => e.stopPropagation());
  const canvas = scene.game.canvas;
  const ubicar = () => {
    if (campo.parentElement !== canvas.parentElement) canvas.parentElement.appendChild(campo);
    const r = canvas.getBoundingClientRect();
    const k = r.width / scene.scale.width;
    Object.assign(campo.style, {
      left: `${r.left + (x - ancho / 2) * k}px`,
      top: `${r.top + (y - alto / 2) * k}px`,
      width: `${ancho * k}px`,
      height: `${alto * k}px`,
      fontSize: `${Math.max(16, alto * k * 0.5)}px`,
      borderWidth: `${Math.max(2, 4 * k)}px`,
    });
  };
  const obs = new ResizeObserver(ubicar);
  obs.observe(canvas);
  window.addEventListener('resize', ubicar);
  scene.scale.on('resize', ubicar);
  scene.scale.on('enterfullscreen', ubicar);
  scene.scale.on('leavefullscreen', ubicar);
  ubicar();
  scene.events.once('shutdown', () => {
    obs.disconnect();
    window.removeEventListener('resize', ubicar);
    scene.scale.off('resize', ubicar);
    scene.scale.off('enterfullscreen', ubicar);
    scene.scale.off('leavefullscreen', ubicar);
    campo.remove();
  });
  return campo;
}
