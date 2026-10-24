"""python3 -m tools.mhp3.build RESEARCH REVIEW_JSON ICON_PROBE NEW_OUTPUT"""
import json
import sqlite3
import struct
import sys
from pathlib import Path
from .sources import native_inputs, load_json, digest
from .localization import validate_localization
from .icons import write_icons

SCHEMA = Path(__file__).with_name('schema.sql').read_text(encoding='utf-8')


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def build(research, review_file, icon_probe, output):
    output = Path(output)
    if output.exists():
        raise ValueError('Output must be a new directory')
    native, sources = native_inputs(research, icon_probe)
    review = load_json(review_file)
    if review['inputs']['native'] != sources[0]['sha256']:
        raise ValueError('Review native fingerprint mismatch')
    translations = validate_localization(research, review, native)
    items = native['items']['items']
    if [i['id'] for i in items] != list(range(979)):
        raise ValueError('Native item slot domain changed')
    output.mkdir(parents=True)
    try:
        icons = write_icons(native['icons'], output / 'icons', items)
        decorations = {r['id']:r for r in native['decorations']['decorationCandidates']}
        db = sqlite3.connect(output / 'mhp3.sqlite')
        db.executescript(SCHEMA)
        with db:
            for item in items:
                id = item['id'];raw = bytes.fromhex(item['recordHex']);r = translations[id]
                if len(raw) != 20 or raw[0] not in range(4):
                    raise ValueError('Invalid native record')
                category = ['general','ammo','coating','decoration'][raw[0]]
                quantity_kind = {0:'internal',94:'infinite',129:'internal',684:'reusable-cooldown'}.get(id, 'count')
                if id and ((raw[2] == 255) != (quantity_kind != 'count')):
                    raise ValueError('Unknown quantity sentinel')
                decoration = None
                if id in decorations:
                    source = decorations[id]
                    if raw[0] != 3 or struct.unpack_from('<H',raw,16)[0] != source['index']:
                        raise ValueError('Decoration item crosswalk changed')
                    decoration = {k:r['decorationReview'][k] for k in ['slots','skills']}
                elif raw[0] == 3:
                    raise ValueError('Missing decoration')
                db.execute('INSERT INTO catalog_items VALUES('+','.join('?'*19)+')',
                    ('mhp3',id,None,None,r['name'],'',item['name'],r['description'],raw[1]+1 if id else None,
                     raw[2] if quantity_kind=='count' else None,*struct.unpack_from('<II',raw,8),icons.get(id),int(id in (0,129)),
                     'native-item-definition;save-id-unverified',category,quantity_kind,encode(decoration) if decoration else None,encode(r['aliases'])))
                db.execute('INSERT INTO catalog_item_localization VALUES(?,?,?,?,?,?,?)',
                    (id,item['name'],r['nameSource'],'official' if r['nameSource']=='GU 官方简中' else 'reviewed',item['description'],r['descriptionSource'],'reviewed'))
            contracts = native['contracts'];quantities = {r['index']:r for r in contracts['quantityTables']}
            for row in native['combinations']['records']:
                raw=row['raw'];q=quantities[raw[5]]
                if struct.unpack('<HH',bytes(raw[:4])) != (row['other'],row['resultCandidate']):
                    raise ValueError('Combination record binding changed')
                db.execute('INSERT INTO p3_combinations VALUES(?,?,?,?,?,?,?,?,?)',
                    (row['index'],raw[6],row['first'],row['other'],row['resultCandidate'],contracts['chanceTable']['values'][raw[4]],q['minimum'],q['maximum'],encode(q['weights'])))
            for row in native['forge']['rows']:
                db.execute('INSERT INTO p3_forge_recipes VALUES(?,?)',(row['index'],row['output']))
                for position,m in enumerate(row['materials']):
                    if not m['id']:
                        if m['quantity']:raise ValueError('Nonempty null material')
                        continue
                    if items[m['id']]['name'] != m['name']:raise ValueError('Forge material name/ID binding changed')
                    db.execute('INSERT INTO p3_forge_materials VALUES(?,?,?,?)',(row['index'],position,m['id'],m['quantity']))
            groups = {r['key']:r['lists'] for r in native['shops']['groups']}
            if [r['ids'] for r in groups['mode21']] != [r['ids'] for r in groups['mode1']]:
                raise ValueError('Common shop lists differ')
            # Consolidated common shop inventory; readable unlock conditions remain unknown.
            for id in groups['mode21'][-1]['ids']:
                price=struct.unpack_from('<I',bytes.fromhex(items[id]['recordHex']),8)[0]
                db.execute('INSERT INTO p3_shops VALUES(?,?,?,?,?,?)',('common',id,'杂货店／浴场商店',None,price,0))
            rotations={3:1,2:2,4:3,1:4,0:5}
            for row in groups['mode4']:
                half=row['index'] in (3,4);rotation=rotations[row['index']]
                for id in row['ids']:
                    base=struct.unpack_from('<I',bytes.fromhex(items[id]['recordHex']),8)[0]
                    db.execute('INSERT INTO p3_shops VALUES(?,?,?,?,?,?)',(f'peddler:{rotation}',id,'行商婆婆',rotation,base//2 if half else base,int(half)))
            data_version = digest(encode({'sources':sources,'review':digest(Path(review_file).read_bytes())}).encode())
            db.executemany('INSERT INTO meta VALUES(?,?)',[('catalog_schema','mhp3-items-v1'),('data_version',data_version)])
        counts = audit(db, native, translations, output / 'icons')
        db.close()
        (output/'audit.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2)+'\n')
        outputs={str(p.relative_to(output)):digest(p.read_bytes()) for p in sorted(output.rglob('*')) if p.is_file()}
        (output/'manifest.json').write_text(json.dumps({'schema':'mhp3-items-build-v1','sources':sources,'review':{'path':str(Path(review_file).resolve()),'sha256':digest(Path(review_file).read_bytes())},'outputs':outputs},ensure_ascii=False,indent=2)+'\n')
        return counts
    except Exception as error:
        (output/'FAILED.txt').write_text(str(error))
        raise


def audit(db, native, translations, icons):
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
        raise ValueError('SQLite integrity/endpoint check failed')
    counts = dict(items=db.execute('SELECT count(*) FROM catalog_items').fetchone()[0],
        visibleItems=db.execute('SELECT count(*) FROM catalog_items WHERE is_placeholder=0').fetchone()[0],
        combinations=db.execute('SELECT count(*) FROM p3_combinations').fetchone()[0],
        decorations=db.execute('SELECT count(*) FROM catalog_items WHERE decoration_json IS NOT NULL').fetchone()[0],
        recipes=db.execute('SELECT count(*) FROM p3_forge_recipes').fetchone()[0],
        shopItems=db.execute('SELECT count(DISTINCT item_id) FROM p3_shops').fetchone()[0],icons=len(list(icons.glob('*.png'))))
    if list(counts.values()) != [979,977,117,164,198,147,296]:
        raise ValueError(f'P3 full-domain count mismatch: {counts}')
    db.row_factory=sqlite3.Row
    for source in native['items']['items']:
        row=db.execute('SELECT * FROM catalog_items WHERE item_id=?',(source['id'],)).fetchone()
        raw=bytes.fromhex(source['recordHex']);r=translations[source['id']]
        if (row['name_cn'],row['description'],row['buy_price'],row['sell_price']) != (r['name'],r['description'],*struct.unpack_from('<II',raw,8)):
            raise ValueError('Runtime text or native price changed')
        if row['icon_path']:
            p=icons/Path(row['icon_path']).name
            if p.stem != digest(p.read_bytes()):raise ValueError('Runtime icon hash mismatch')
    quantities = {r['index']:r for r in native['contracts']['quantityTables']}
    for source in native['combinations']['records']:
        row = db.execute('SELECT * FROM p3_combinations WHERE recipe_index=?',(source['index'],)).fetchone()
        raw = source['raw']; q = quantities[raw[5]]
        expected = (source['index'],raw[6],source['first'],source['other'],source['resultCandidate'],native['contracts']['chanceTable']['values'][raw[4]],q['minimum'],q['maximum'],encode(q['weights']))
        if tuple(row) != expected: raise ValueError('Combination numbers changed')
    for source in native['decorations']['decorationCandidates']:
        row = db.execute('SELECT decoration_json FROM catalog_items WHERE item_id=?',(source['id'],)).fetchone()
        info = json.loads(row[0]);raw=source['raw']
        if info['slots'] != raw[0] or [(s['id'],s['points']) for s in info['skills']] != [(raw[k],(raw[k+1]+128)%256-128) for k in (1,3) if raw[k]]:
            raise ValueError('Decoration numbers changed')
    for source in native['items']['items']:
        row=db.execute('SELECT rarity,max_stack FROM catalog_items WHERE item_id=?',(source['id'],)).fetchone();raw=bytes.fromhex(source['recordHex'])
        if tuple(row) != (raw[1]+1 if source['id'] else None,raw[2] if source['id'] not in (0,94,129,684) else None):raise ValueError('Rarity or quantity changed')
    for shop in db.execute('SELECT * FROM p3_shops'):
        price=struct.unpack_from('<I',bytes.fromhex(native['items']['items'][shop['item_id']]['recordHex']),8)[0]
        if shop['price'] != (price//2 if shop['half_price'] else price):raise ValueError('Shop price changed')
    for recipe in native['forge']['rows']:
        actual=[tuple(row) for row in db.execute('SELECT item_id,quantity FROM p3_forge_materials WHERE recipe_index=? ORDER BY position',(recipe['index'],))]
        if actual != [(m['id'],m['quantity']) for m in recipe['materials'] if m['id']]:raise ValueError('Forge materials changed')
    return {**counts,'translationBindings':979,'nativeForgeMaterials':'identical','foreignKeys':'ok','gameExecution':'not-performed'}


if __name__ == '__main__':
    print(json.dumps(build(*sys.argv[1:]), ensure_ascii=False))
