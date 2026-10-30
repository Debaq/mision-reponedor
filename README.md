# Misión Reponedor

Juego web educativo: simulador de reponedor de supermercado para jóvenes de 20 a 24 años, pensado para personas que no leen (todo tiene imagen y voz).

Hecho con **Phaser 3 + Vite**. Gráficos de [Kenney](https://kenney.nl) (CC0). Voces neuronales de Microsoft (edge-tts).

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ (sitio estático: GitHub Pages, itch.io, Netlify...)
```

En la pantalla de inicio, el botón **Etapas** permite al docente saltar a cualquier parte del juego.

## Publicar una actualización

Cada build lleva una versión automática: `versión de package.json + commit de git` (por ejemplo `0.1.0+7bc38a4`). Se ve abajo a la izquierda en la pantalla de inicio.

1. Hacer commit de los cambios (el hash del commit forma parte de la versión).
2. Opcional: `npm version patch` para subir el número (0.1.0 → 0.1.1).
3. `npm run build` y subir la carpeta `dist/` completa.

No hace falta que nadie fuerce la recarga:

- Al abrir, el juego consulta `version.json` sin caché. Si hay una versión más nueva, recarga solo.
- Imágenes y audios se piden con `?v=<versión>`, así que se descargan de nuevo cuando cambian.
- El código JS ya lleva un hash en el nombre, gracias a Vite.
- `public/_headers` le indica a Netlify y Cloudflare Pages que no guarden en caché `index.html` ni `version.json`.

## Etapas (según el documento)

1. Crear personaje: nombre, hombre / mujer / no binario, piel, pelo y ropa. Se valida la vestimenta: pantalón largo y chaleco.
2. Aviso de contratación en el celular.
3. Conversación con el supervisor (habilidades sociales, con respuestas buenas y malas).
4. Lista de reposición: imagen del producto + cantidad, leída en voz alta.
5. Tutorial guiado: identificar, buscar en la bodega, seleccionar y contar, trasladar, ubicar en la estantería, ordenar.
6. Práctica sin ayuda con una lista nueva.
7. Tareas extra: limpiar un derrame, recoger basura, retirar productos vencidos y orientar a una clienta.
8. Fin del turno, con estrellas, puntos y errores por etapa.

## Estrellas y puntos

Cada etapa con decisiones (marcadas con `id` en `src/lib/flujo.js`) da estrellas al terminar: 0 errores = 3, 1 o 2 errores = 2, más = 1 (nunca 0). Puntos: 100 / 70 / 40. El marcador está arriba a la derecha.

El progreso se guarda en el navegador (`localStorage`) por nombre de jugador: mejores estrellas por etapa, récord de puntos y partidas jugadas (`src/lib/perfil.js`). Se usará para desbloquear ropa y secciones.

## Editar textos y voces

- Guion: `src/data/voces.json`. Las versiones `id_f` (mujer) e `id_n` (no binario, lenguaje neutro) reemplazan a `id` según el personaje.
- Productos: `src/data/productos.json`. Listas y estanterías de cada nivel: `src/data/niveles.json`.
- Después de editar, regenerar los audios (requiere [uv](https://docs.astral.sh/uv/)):

```bash
npm run voces
```

Solo se regeneran las líneas que cambiaron.

## Identidad visual

El supermercado "El Barrio" es ficticio y usa **violeta + turquesa** para no parecerse a cadenas reales (Jumbo, Líder, Unimarc, Tottus, Santa Isabel).
