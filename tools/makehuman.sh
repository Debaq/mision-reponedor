#!/bin/sh
# Abre MakeHuman 1.3 (instalado en /opt/makehuman) con un Python compatible.
# Con Python 3.14 y numpy 2 se cae al crear texturas, y en Wayland falla la ventana:
# se usa Python 3.11 + numpy 1.x aislados (uv) y X11 (XWayland).
cd /opt/makehuman && QT_QPA_PLATFORM=xcb exec uv run -q --python 3.11 --with 'numpy<2' --with pyqt5 --with 'pyopengl==3.1.7' python makehuman.py "$@"
