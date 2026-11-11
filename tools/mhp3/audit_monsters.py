"""Independent read-only audit of a monster delivery against its full base/input."""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path


def audit(base_path, source_path, delivery_path):
    base_path, source_path, delivery = map(Path, (base_path, source_path, delivery_path))
    if (delivery / 'FAILED.txt').exists():
        raise ValueError('Failed delivery must not be installed')
    manifest = json.loads((delivery / 'manifest.json').read_bytes())
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    assert manifest['status'] == 'success' and manifest['databaseSha256'] == sha(delivery / 'mhp3.sqlite')
    assert manifest['baseSha256'] == sha(base_path) and manifest['inputSha256'] == sha(source_path)
    assert manifest['auditSha256'] == sha(delivery / 'audit.json')
    source = json.loads(source_path.read_bytes())
    with sqlite3.connect(base_path.resolve().as_uri() + '?mode=ro', uri=True) as base, sqlite3.connect((delivery / 'mhp3.sqlite').resolve().as_uri() + '?mode=ro', uri=True) as db:
        assert db.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
        original = {n: sql for n, sql in base.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        for n, sql in original.items():
            assert db.execute('SELECT sql FROM sqlite_master WHERE name=?', (n,)).fetchone()[0] == sql
            if n == 'meta':
                current = dict(db.execute('SELECT * FROM meta'))
                assert all(current[k] == v for k, v in base.execute('SELECT * FROM meta') if k not in ('monster_schema', 'monster_data_version'))
            elif n not in ('p3_monsters', 'p3_monster_drops'):
                assert sorted(base.execute('SELECT * FROM "'+n+'"').fetchall(), key=repr) == sorted(db.execute('SELECT * FROM "'+n+'"').fetchall(), key=repr), n
        actual = {i: json.loads(detail) for i, detail in db.execute('SELECT monster_id,detail_json FROM p3_monsters')}
        assert actual == {m['monsterId']: m for m in source['monsters']}
        assert db.execute("SELECT record_scope,count(*) FROM p3_monsters GROUP BY record_scope ORDER BY record_scope").fetchall() == [('extended', 5), ('normal', 60)]
        assert len({m['bookIndex'] for m in actual.values() if m['recordScope'] == 'normal'}) == 60
        expected = {d['id']: d for d in source['drops']}
        assert len(expected) == db.execute('SELECT count(*) FROM p3_monster_drops').fetchone()[0]
        for i, monster, item, key, rank, method, quantity, probability, detail in db.execute('SELECT * FROM p3_monster_drops'):
            assert dict(id=i, monsterId=monster, itemId=item, sourceKey=key, rankId=rank, methodId=method, quantity=quantity, probability=probability, **json.loads(detail)) == expected[i]
        assert not db.execute('SELECT d.id FROM p3_monster_drops d LEFT JOIN catalog_items i ON i.item_id=d.item_id LEFT JOIN p3_monsters m ON m.monster_id=d.monster_id WHERE i.item_id IS NULL OR i.is_placeholder=1 OR m.monster_id IS NULL').fetchall()
        # Reverse item source count must be the same relation set as forward drops.
        assert sum(n for n, in db.execute('SELECT count(*) FROM p3_monster_drops GROUP BY item_id')) == len(expected)
    for icon in source['icons']:
        assert sha(delivery / 'icons' / (icon['pngSha256'] + '.png')) == icon['pngSha256']
    return dict(status='success', databaseSha256=manifest['databaseSha256'], inputSha256=manifest['inputSha256'],
                preservedTables=len(original), monsters=len(actual), drops=len(expected), iconBindings=len(source['icons']))


if __name__ == '__main__':
    print(json.dumps(audit(*sys.argv[1:]), ensure_ascii=False, indent=2))
