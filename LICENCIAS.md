# Licencias

Misión Reponedor usa dos licencias, una para el código y otra para el contenido.

| Qué | Licencia |
|---|---|
| Código (`src/`, `tools/`, `index.html`, `vite.config.js` y demás archivos de programa) | [MIT](LICENSE) |
| Contenido propio: escenarios, mapa, personajes y productos renderizados, guion, textos, capturas e íconos | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) |

Para atribuir el contenido basta con: *"Misión Reponedor", Nicolás Baier Quezada, CC BY 4.0*, con el enlace al repositorio o al DOI de Zenodo.

## Material de terceros

| Qué | Dónde | Origen y licencia |
|---|---|---|
| Gráficos de interfaz, productos de comida y sonidos | `public/assets/ui`, parte de `public/assets/productos`, `public/assets/sfx` | [Kenney](https://kenney.nl), CC0 (dominio público). Ver `public/assets/LICENCIA_KENNEY.txt` |
| Modelos base de los personajes | renders en `public/assets/personaje3d` | Hechos con [MakeHuman](http://www.makehumancommunity.org); lo que exporta MakeHuman es CC0 |
| Motor del juego | se incluye en el juego compilado | [Phaser 3](https://phaser.io), MIT |
| Voces | `public/assets/audio/voces` | Generadas con voces neuronales de Microsoft mediante [edge-tts](https://github.com/rany2/edge-tts). **No están cubiertas por CC BY 4.0**: su uso queda sujeto a los términos de Microsoft. Se pueden regenerar con otra voz editando el guion y ejecutando `npm run voces`. |
