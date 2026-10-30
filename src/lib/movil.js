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
