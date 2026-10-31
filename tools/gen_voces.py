"""Genera los audios del juego con las voces neuronales de Microsoft (edge-tts).

Uso:  npm run voces      (equivale a: uv run --with edge-tts python tools/gen_voces.py)

- Lee src/data/voces.json (guion escrito a mano).
- Agrega líneas automáticas (nombres de productos, números, lista de cada nivel)
  y las guarda en src/data/voces_auto.json para que el juego muestre el subtítulo.
- Solo regenera los audios cuyo texto o voz cambió (ver public/assets/audio/voces/_manifest.json).
"""
import asyncio, hashlib, json, pathlib, sys

import edge_tts

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DATA = RAIZ / 'src' / 'data'
OUT = RAIZ / 'public' / 'assets' / 'audio' / 'voces'

VOCES = {
    'guia':    ('es-CL-CatalinaNeural', '-8%'),
    'jugador': ('es-CO-GonzaloNeural', '-8%'),
    'jugadora': ('es-CL-CatalinaNeural', '-8%'),
    'jugadore': ('es-CO-SalomeNeural', '-8%'),
    'jefe':    ('es-CL-LorenzoNeural', '-5%'),
    'cliente': ('es-MX-DaliaNeural', '+0%'),
}
NUM = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
# Días del mes, como se dicen en una fecha ("primero de diciembre").
DIAS = ['', 'primero', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
        'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno',
        'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho',
        'veintinueve', 'treinta', 'treinta y uno']
MESES = {11: ('noviembre', 30), 12: ('diciembre', 31)}


def lineas_auto():
    prods = json.loads((DATA / 'productos.json').read_text())
    auto = {}
    for pid, p in prods.items():
        auto[f'prod_{pid}'] = {'voz': 'guia', 'texto': p['nombre'] + '.'}
    for n in range(1, 11):
        auto[f'num_{n}'] = {'voz': 'guia', 'texto': NUM[n].capitalize() + '.'}
    # Cantidades de la lista: todas las de 1 a 6 de cada producto (los días al azar arman listas nuevas).
    for pid, p in prods.items():
        for n in range(1, 7):
            txt = f"{p['uno'].capitalize()} {p['sing']}." if n == 1 else f"{NUM[n].capitalize()} {p['plur']}."
            auto[f"lista_{pid}_{n}"] = {'voz': 'guia', 'texto': txt}
    # Leche vencida (escena Vencidos): fechas de las cajas y el día de hoy (del 6 al 24 de noviembre).
    for m, (mes, dias) in MESES.items():
        for d in range(1, dias + 1):
            auto[f'fecha_{d:02d}{m}'] = {'voz': 'guia', 'texto': f'Vence el {DIAS[d]} de {mes}.'}
    for d in range(6, 25):
        auto[f'hoy_{d:02d}11'] = {'voz': 'guia', 'texto': f'Hoy es {DIAS[d]} de noviembre.'}
    return auto


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    guion = {k: v for k, v in json.loads((DATA / 'voces.json').read_text()).items() if not k.startswith('_')}
    auto = lineas_auto()
    # Respuestas del jugador: versión femenina y no binaria automática si no hay una escrita.
    for vid, l in list(guion.items()):
        if l['voz'] != 'jugador':
            continue
        for suf, voz in (('_f', 'jugadora'), ('_n', 'jugadore')):
            if f'{vid}{suf}' not in guion:
                auto[f'{vid}{suf}'] = {'voz': voz, 'texto': l['texto']}
    (DATA / 'voces_auto.json').write_text(json.dumps(auto, ensure_ascii=False, indent=1))
    todas = {**guion, **auto}

    man_path = OUT / '_manifest.json'
    manifest = json.loads(man_path.read_text()) if man_path.exists() else {}
    pendientes = []
    for vid, l in todas.items():
        voz, rate = VOCES[l['voz']]
        h = hashlib.sha1(f"{voz}|{rate}|{l['texto']}".encode()).hexdigest()[:12]
        if manifest.get(vid) != h or not (OUT / f'{vid}.mp3').exists():
            pendientes.append((vid, l['texto'], voz, rate, h))

    sem = asyncio.Semaphore(4)

    async def gen(vid, texto, voz, rate, h):
        async with sem:
            for intento in range(3):
                try:
                    await edge_tts.Communicate(texto, voz, rate=rate).save(str(OUT / f'{vid}.mp3'))
                    manifest[vid] = h
                    print('ok', vid)
                    return
                except Exception as e:  # red intermitente
                    print('reintento', vid, e, file=sys.stderr)
                    await asyncio.sleep(2)
            print('FALLÓ', vid, file=sys.stderr)

    await asyncio.gather(*(gen(*p) for p in pendientes))
    # borrar audios que ya no están en el guion
    for f in OUT.glob('*.mp3'):
        if f.stem not in todas:
            f.unlink()
            manifest.pop(f.stem, None)
    man_path.write_text(json.dumps(manifest, indent=1, sort_keys=True))
    print(f'{len(pendientes)} generados, {len(todas)} en total')


asyncio.run(main())
