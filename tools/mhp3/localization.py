"""Validate reviewed text bindings, official evidence and unmodified native skills."""
import re
import sqlite3
from pathlib import Path
from .sources import digest, load_json


def japanese_key(value):
    return re.sub('[Ａ-Ｚａ-ｚ０-９]', lambda m: chr(ord(m[0])-0xfee0), value.strip())


def validate_localization(research, review, native):
    snapshot = Path(research) / 'generated/mh-save-edit/terminology/versions/gu-pass-02'
    manifest = load_json(snapshot / 'manifest.json')
    for name in ['terminology.sqlite', 'audit.json']:
        if digest((snapshot / name).read_bytes()) != manifest['outputs'][name]:
            raise ValueError(f'GU evidence changed: {name}')
    if review['inputs']['gu'] != manifest['outputs']['terminology.sqlite']:
        raise ValueError('Review belongs to a different GU snapshot')
    audit = load_json(snapshot / 'audit.json')['state']
    with sqlite3.connect(f'file:{snapshot / "terminology.sqlite"}?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        terms = {r['id']: dict(r) for r in db.execute("SELECT * FROM terms WHERE kind='item'")}
    rows = review['items']
    if len(rows) != len(native['items']['items']) or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Translation identities are incomplete or duplicated')
    by_id = {r['id']: r for r in rows}
    for item in native['items']['items']:
        r = by_id[item['id']]
        if (r['ja'], r['descriptionJp']) != (item['name'], item['description']):
            raise ValueError(f'Stale translation binding: {item["id"]}')
        if r['reviewStatus'] != 'reviewed':
            raise ValueError(f'Unreviewed translation: {item["id"]}')
        for field in ['name', 'description']:
            if not r[field] or re.search('[ぁ-ヿ]', r[field]) or not r.get(field+'Evidence'):
                raise ValueError(f'Missing Chinese/evidence: {item["id"]}/{field}')
        codes = lambda s: sorted(re.findall(r'~[A-Z][0-9A-F]{2}', s))
        if codes(r['description']) != codes(r['descriptionJp']):
            raise ValueError(f'Translation changed control codes: {item["id"]}')
        evidence = r['nameEvidence']
        if evidence['kind'] == 'gu':
            term = terms[evidence['termId']]
            chosen = audit['chosen'][term['id']]['zhHans']
            source = audit['evidence'][chosen['evidenceKey']]
            if not (chosen['sourceClass'] == 'gu_official' and chosen['evidenceKey'] == evidence['evidenceKey']
                    and source['termId'] == term['id'] and source['value'] == term['zhHans']
                    and japanese_key(term['ja']) == japanese_key(r['ja']) and term['zhHans'] == r['name']):
                raise ValueError(f'Invalid GU name evidence: {item["id"]}')
    skills = {s['id']: s for s in review['skills']}
    for row in native['decorations']['decorationCandidates']:
        r = by_id[row['id']]
        expected = [{**skills[s['id']], 'points': (row['raw'][2+i*2]+128)%256-128}
                    for i, s in enumerate(row['skillCandidates']) if s['id']]
        for s in row['skillCandidates']:
            if s['id'] and skills[s['id']]['nameJp'] != s['name']:
                raise ValueError('Skill localization identity changed')
        if r['decorationReview']['slots'] != row['raw'][0] or r['decorationReview']['skills'] != expected:
            raise ValueError(f'Review changed decoration numbers: {row["id"]}')
        if not r['name'].endswith(f'【{row["raw"][0]}】'):
            raise ValueError(f'Name has wrong P3 slot suffix: {row["id"]}')
    return by_id
