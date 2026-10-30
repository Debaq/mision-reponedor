// Efectos de sonido (Kenney Interface Sounds, CC0).
export const SFX = {
  click: 'click_002',
  bien: 'confirmation_002',
  error: 'error_004',
  soltar: 'drop_002',
  tomar: 'pluck_001',
  abrir: 'open_001',
  logro: 'maximize_006',
  tick: 'tick_002',
  vidrio: 'glass_002',
  frotar: 'scratch_002',
};

export function sfx(scene, nombre, volumen = 0.6) {
  scene.sound.play('sfx_' + SFX[nombre], { volume: volumen });
}
