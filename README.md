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

## Etapas (según el documento)

1. Crear personaje: nombre, hombre / mujer / no binario, piel, pelo y ropa. Se valida la vestimenta: pantalón largo y chaleco.
2. Aviso de contratación en el celular.
3. Conversación con el supervisor (habilidades sociales, con respuestas buenas y malas).
4. Lista de reposición: imagen del producto + cantidad, leída en voz alta.
5. Tutorial guiado: identificar, buscar en la bodega, seleccionar y contar, trasladar, ubicar en la estantería, ordenar.
6. Práctica sin ayuda con una lista nueva.
7. Tareas extra: limpiar un derrame, recoger basura, retirar productos vencidos y orientar a una clienta.
8. Fin del turno, con un resumen de errores por etapa.

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
