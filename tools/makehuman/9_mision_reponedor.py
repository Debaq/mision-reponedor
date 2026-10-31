"""Plugin de MakeHuman para Misión Reponedor: exporta los cuerpos, peinados, zapatos y expresiones.

Solo actúa si la variable de entorno MISION_EXPORT apunta a un JSON de configuración (lo crea
tools/mh_exportar.py); si no, no hace nada y MakeHuman funciona normal.
Para cada modelo: aplica los modificadores (o carga su .mhm), le pone el esqueleto "default"
(con huesos de la cara), ojos, cejas, pestañas y dientes, y exporta:
  <modelo>_cuerpo.fbx, <modelo>_pelo_<peinado>.fbx, <modelo>_zapatos_<z>.fbx (con esqueleto) y
  <modelo>_expr_<expresion>.obj (malla con la expresión aplicada, para shape keys en Blender).
Al terminar escribe <salida>/listo.txt y cierra MakeHuman.
"""
import importlib
import json
import os
import sys
import traceback

import getpath
import gui3d
import log
import mh

CONFIG = os.environ.get('MISION_EXPORT')


def _modulo_exportador(clase):
    e = gui3d.app.mhapi.exports.getExporterByClassname(clase)
    paquete = type(e).__module__
    return sys.modules[paquete], importlib.import_module(paquete + ('.mh2fbx' if clase == 'ExporterFBX' else '.mh2obj'))


def _datos(sub):
    return getpath.getSysDataPath(sub)


def _proxy(tab, archivo):
    """Equipa un proxy (pelo, cejas, pestañas, dientes, ropa) desde la librería correspondiente."""
    tarea = gui3d.app.getTask('Geometries', tab)
    if tab == 'Clothes':
        tarea.selectProxy(archivo)
    else:
        tarea.selectProxy(archivo)


def _quitar(tab):
    tarea = gui3d.app.getTask('Geometries', tab)
    if tab == 'Clothes':
        for p in list(tarea.getSelection()):
            tarea.deselectProxy(p.file)
    else:
        tarea.selectProxy(None)


def _exportar_fbx(human, ruta):
    modcfg, mh2fbx = _modulo_exportador('ExporterFBX')
    cfg = modcfg.FbxConfig()
    cfg.setHuman(human)
    cfg.feetOnGround = True
    cfg.scale = 0.1       # MakeHuman trabaja en decímetros: 0,1 = metros
    cfg.unit = 'meter'
    cfg.binary = True
    mh2fbx.exportFbx(ruta, cfg)


def _exportar_obj(human, ruta):
    modcfg, mh2obj = _modulo_exportador('ExporterOBJ')
    cfg = modcfg.ObjConfig()
    cfg.setHuman(human)
    cfg.feetOnGround = True
    cfg.scale = 0.1
    cfg.unit = 'meter'
    cfg.useNormals = False
    mh2obj.exportObj(ruta, cfg)


def _expresion(archivo):
    tarea = gui3d.app.getTask('Pose/Animate', 'Expressions')
    if tarea.base_bvh is None:
        tarea._load_pose_units()   # (normalmente se cargan al abrir esa pestaña)
    tarea.chooseExpression(archivo)


def ejecutar():
    try:
        cfg = json.load(open(CONFIG))
        salida = cfg['salida']
        os.makedirs(salida, exist_ok=True)
        human = gui3d.app.selectedHuman
        import skeleton
        for m in cfg['modelos']:
            nombre = m['nombre']
            log.message('Mision: modelo %s', nombre)
            human.resetMeshValues()
            if m.get('mhm'):
                human.load(m['mhm'], True)
            for mod, valor in m.get('modificadores', {}).items():
                human.getModifier(mod).setValue(valor)
            human.applyAllTargets()
            human.setSkeleton(skeleton.load(_datos('rigs/default.mhskel'), human.meshData))
            for tab in ('Hair', 'Clothes'):
                _quitar(tab)
            _proxy('Eyebrows', _datos('eyebrows/%s/%s.mhpxy' % (m['cejas'], m['cejas'])))
            _proxy('Eyelashes', _datos('eyelashes/%s/%s.mhpxy' % (m['pestanas'], m['pestanas'])))
            _proxy('Teeth', _datos('teeth/teeth_base/teeth_base.mhpxy'))
            _exportar_fbx(human, os.path.join(salida, '%s_cuerpo.fbx' % nombre))
            for e in m.get('expresiones', []):
                _expresion(_datos('expressions/%s.mhpose' % e) if e != 'neutra' else None)
                _exportar_obj(human, os.path.join(salida, '%s_expr_%s.obj' % (nombre, e)))
            _expresion(None)
            # Cejas alternativas (solo la malla de las cejas cambia)
            for c in m.get('cejas_extra', []):
                _proxy('Eyebrows', _datos('eyebrows/%s/%s.mhpxy' % (c, c)))
                for e in m.get('expresiones', []):
                    _expresion(_datos('expressions/%s.mhpose' % e) if e != 'neutra' else None)
                    _exportar_obj(human, os.path.join(salida, '%s_cejas_%s_%s.obj' % (nombre, c, e)))
                _expresion(None)
            _proxy('Eyebrows', _datos('eyebrows/%s/%s.mhpxy' % (m['cejas'], m['cejas'])))
            for p in m.get('pelos', []):
                _proxy('Hair', _datos('hair/%s/%s.mhpxy' % (p, p)))
                _exportar_fbx(human, os.path.join(salida, '%s_pelo_%s.fbx' % (nombre, p)))
            _quitar('Hair')
            for z in m.get('zapatos', []):
                _proxy('Clothes', _datos('clothes/%s/%s.mhpxy' % (z, z)))
                _exportar_fbx(human, os.path.join(salida, '%s_zapatos_%s.fbx' % (nombre, z)))
                _quitar('Clothes')
        open(os.path.join(salida, 'listo.txt'), 'w').write('ok')
    except Exception:
        open(os.path.join(json.load(open(CONFIG))['salida'], 'error.txt'), 'w').write(traceback.format_exc())
    finally:
        os._exit(0)


def load(app):
    if not CONFIG:
        return
    from PyQt5.QtCore import QTimer
    QTimer.singleShot(4000, ejecutar)


def unload(app):
    pass
