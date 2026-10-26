"""Reuse reviewed common armor terminology only; never infer equipment identity."""
import sqlite3
from pathlib import Path
from .skill_sources import digest, load


def armor_names(native, review, terminology_dir):
    rows = review.get('armorNames', [])
    if not rows:
        return {}
    if not terminology_dir:
        raise ValueError('Reviewed armor names require the frozen terminology snapshot')
    root = Path(terminology_dir)
    manifest = load(root / 'manifest.json')
    for name in ('terminology.sqlite', 'audit.json'):
        if digest((root / name).read_bytes()) != manifest['outputs'][name] or manifest['outputs'][name] != review['inputs']['armorTerminology'][name]:
            raise ValueError('Armor terminology fingerprint mismatch')
    audit = load(root / 'audit.json')['state']
    with sqlite3.connect((root / 'terminology.sqlite').resolve().as_uri()+'?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        terms = {r['id']: dict(r) for r in db.execute("SELECT * FROM terms WHERE kind='armor'")}
    originals = {a['armorKey']: a for a in native}
    result = {}
    for r in rows:
        key = r['armorKey']
        if key in result or key not in originals:
            raise ValueError('Invalid armor name identity')
        term = terms[r['termId']]
        chosen = audit['chosen'][term['id']]['zhHans']
        evidence = audit['evidence'][chosen['evidenceKey']]
        if not (r['reviewStatus'] == 'reviewed' and r['nameRawJp'] == originals[key]['nameRawJp'] == term['ja']
                and r['nameCn'] == term['zhHans'] == evidence['value'] and r['nameCn']
                and chosen['sourceClass'] == 'gu_official' and chosen['evidenceKey'] == r['evidenceKey']
                and evidence['termId'] == term['id']):
            raise ValueError('Invalid common armor name evidence')
        result[key] = r['nameCn']
    return result
