import Phaser from 'phaser';
import { ANCHO, ALTO } from './lib/estilo.js';
import Boot from './scenes/Boot.js';
import Hud from './scenes/Hud.js';
import Inicio from './scenes/Inicio.js';
import Etapas from './scenes/Etapas.js';
import Avatar from './scenes/Avatar.js';
import Contrato from './scenes/Contrato.js';
import Supervisor from './scenes/Supervisor.js';
import Lista from './scenes/Lista.js';
import Bodega from './scenes/Bodega.js';
import Traslado from './scenes/Traslado.js';
import Sala from './scenes/Sala.js';
import Ordenes from './scenes/Ordenes.js';
import Derrame from './scenes/Derrame.js';
import Basura from './scenes/Basura.js';
import Vencidos from './scenes/Vencidos.js';
import Cliente from './scenes/Cliente.js';
import Fin from './scenes/Fin.js';
import { revisarVersion, VERSION } from './lib/version.js';
import { pausarEnVertical } from './lib/movil.js';

function iniciar() {
  const juego = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'juego',
    width: ANCHO,
    height: ALTO,
    backgroundColor: '#1f2d3a',
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Boot, Inicio, Etapas, Avatar, Contrato, Supervisor, Lista, Bodega, Traslado, Sala,
      Ordenes, Derrame, Basura, Vencidos, Cliente, Fin, Hud],
  });
  pausarEnVertical(juego);
  // Para depurar desde la consola del navegador (solo en desarrollo).
  if (import.meta.env.DEV) window.juego = juego;
}

console.info('Misión Reponedor', VERSION);
// Si hay una versión nueva publicada, recarga antes de arrancar el juego.
revisarVersion().then((recargando) => recargando || iniciar());
