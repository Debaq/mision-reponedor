// Ajustes para celulares y tablets.
const VERTICAL_TACTIL = '(orientation: portrait) and (pointer: coarse)';

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches;

// ---- Modo compacto (celular en horizontal; ver docs/plan-movil.md)
// Pantalla táctil con el lado corto < 500 px CSS, o ?movil=1 en la URL (para probar en PC). No cambia
// las escenas: agranda lo que se toca, sube lo arrastrado sobre el dedo y da más margen al soltar.
const FORZADO = new URLSearchParams(location.search).has('movil');
export const compacto = () => FORZADO || (esTactil() && Math.min(innerWidth, innerHeight) < 500);

// px del juego que miden `px` en la pantalla real (el juego se ve achicado en el celular).
export const enJuego = (scene, px) => px * scene.scale.displayScale.x;

// Al arrastrar, cuánto se sube el objeto sobre el dedo para que el dedo no lo tape (0 fuera del celular).
export const alzaDedo = (scene) => (compacto() ? enJuego(scene, 40) : 0);

// Multiplicador de las zonas donde se suelta (más margen en el celular).
export const holgura = () => (compacto() ? 1.25 : 1);

// Agranda la zona de toque de una imagen hasta `minimo` px reales (lo recomendado para el dedo), sin
// cambiar cómo se ve. Llamar después de setInteractive.
export function tocable(img, minimo = 44) {
  if (!compacto() || !img.input) return img;
  const lado = enJuego(img.scene, minimo);
  const { width: fw, height: fh } = img.frame;
  const w = Math.max(fw, lado / Math.abs(img.scaleX));
  const h = Math.max(fh, lado / Math.abs(img.scaleY));
  img.input.hitArea.setTo((fw - w) / 2, (fh - h) / 2, w, h);
  return img;
}

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

// iPhone con Safari: no deja usar pantalla completa desde una página. Aviso (para quien acompaña al
// jugador) de cómo agregarlo a la pantalla de inicio, que lo abre sin barras. Sale en la portada
// hasta que se cierra con la ✕; instalado ya no sale.
export function avisoInstalar(scene) {
  const iphone = /iPhone|iPod/.test(navigator.userAgent);
  if (!iphone || navigator.standalone || !compacto()) return;
  try {
    if (localStorage.getItem('avisoInstalar')) return;
  } catch {
    // sin almacenamiento: se muestra igual
  }
  const aviso = document.createElement('div');
  aviso.className = 'aviso-instalar';
  aviso.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>
    </svg>
    <span>Para jugar en pantalla completa: <b>Compartir</b> → <b>Agregar a inicio</b></span>
    <button type="button" aria-label="Cerrar">✕</button>`;
  scene.game.canvas.parentElement.appendChild(aviso);
  aviso.querySelector('button').addEventListener('click', () => {
    aviso.remove();
    try {
      localStorage.setItem('avisoInstalar', '1');
    } catch {
      // sin almacenamiento: vuelve a salir la próxima vez
    }
  });
  scene.events.once('shutdown', () => aviso.remove());
}
