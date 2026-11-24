import Phaser from 'phaser';
import { ANCHO, ALTO } from './lib/estilo.js';
import { Centrado } from './lib/pantalla.js';
import Boot from './scenes/Boot.js';
import Hud from './scenes/Hud.js';
import Inicio from './scenes/Inicio.js';
import Etapas from './scenes/Etapas.js';
import Avatar from './scenes/Avatar.js';
import Turnos from './scenes/Turnos.js';
import Contrato from './scenes/Contrato.js';
import Supervisor from './scenes/Supervisor.js';
import Lista from './scenes/Lista.js';
import Mapa from './scenes/Mapa.js';
import Bodega from './scenes/Bodega.js';
import Traslado from './scenes/Traslado.js';
import Sala from './scenes/Sala.js';
import Ordenes from './scenes/Ordenes.js';
import Derrame from './scenes/Derrame.js';
import Basura from './scenes/Basura.js';
import Vencidos from './scenes/Vencidos.js';
import Cliente from './scenes/Cliente.js';
import Precios from './scenes/Precios.js';
import Faltantes from './scenes/Faltantes.js';
import Fin from './scenes/Fin.js';
import { revisarVersion, registrarServiceWorker, VERSION } from './lib/version.js';
import { pausarEnVertical } from './lib/movil.js';

function iniciar() {
  const juego = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'juego',
    width: ANCHO,
    height: ALTO,
    backgroundColor: '#1f2d3a',
    // EXPAND: el juego llena la pantalla. En pantallas más anchas que 16:9 se ve más a los lados (los
    // fondos llegan hasta ANCHO_MAX); en más altas (tablets 4:3), franjas arriba y abajo. El contenido
    // queda al centro (plugin Centrado). Sin tope de tamaño: un tope también achica el juego en pantalla.
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
    plugins: { scene: [{ key: 'Centrado', plugin: Centrado, mapping: 'centrado' }] },
    scene: [Boot, Inicio, Etapas, Avatar, Turnos, Contrato, Supervisor, Lista, Mapa, Bodega, Traslado, Sala,
      Ordenes, Derrame, Basura, Vencidos, Cliente, Precios, Faltantes, Fin, Hud],
  });
  pausarEnVertical(juego);
  // Para depurar desde la consola del navegador (solo en desarrollo).
  if (import.meta.env.DEV) window.juego = juego;
}

console.info('Misión Reponedor', VERSION);
// iPhone: el audio web queda mudo con el interruptor de silencio. Como sesión de "reproducción" (igual que
// una app de música) suena igual (iOS 17 o más nuevo; en otros navegadores no existe y no pasa nada).
try {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
} catch {
  // navegador sin sesiones de audio
}
registrarServiceWorker();
// Si hay una versión nueva publicada, recarga antes de arrancar el juego.
revisarVersion().then((recargando) => recargando || iniciar());
