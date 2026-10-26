"""Validate frozen private inputs and reviewed P3 text before building runtime data."""
import base64
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from .icons import verify_png


def digest(blob):
    return hashlib.sha256(blob).hexdigest()


def load(path):
    return json.loads(Path(path).read_bytes())


def display_text(raw):
    return re.sub(r'~[A-Z][0-9A-F]{2}', '', raw).replace('%%', '%').strip()


def reviewed_rows(native, reviewed, key):
    source = {r[key]: r for r in native}
    result = {r[key]: r for r in reviewed}
    if len(source) != len(native) or len(result) != len(reviewed) or source.keys() != result.keys():
        raise ValueError('Incomplete or duplicate translation identities')
    for id, row in result.items():
        original = source[id]
        if row.get('reviewStatus') != 'reviewed':
            raise ValueError(f'Unreviewed translation: {id}')
        for field in ('nameRawJp', 'descriptionRawJp'):
            if row[field] != original[field]:
                raise ValueError(f'Stale original text: {id}/{field}')
        for field in ('nameCn', 'descriptionCn'):
            if not row[field].strip() or re.search(r'[ぁ-ヿ]|~[A-Z][0-9A-F]{2}', row[field]):
                raise ValueError(f'Missing Chinese display text: {id}/{field}')
        numbers = lambda s: sorted(re.findall(r'\d+', unicodedata.normalize('NFKC', s)))
        if numbers(row['descriptionCn']) != numbers(display_text(original['descriptionRawJp'])):
            raise ValueError(f'Translation changed native numbers: {id}')
        for field in ('skillId', 'threshold'):
            if field in original and row[field] != original[field]:
                raise ValueError(f'Translation changed {field}: {id}')
    return result


def read_inputs(native_dir, review_path, icon_probe):
    root = Path(native_dir)
    manifest = load(root / 'archive-manifest.json')
    review = load(review_path)
    records = {r['path']: r for r in manifest['files']}
    inputs = {}
    for name in ('native-skill-contract.json', 'native-armor-contract.json', 'native-charm-contract.json'):
        blob = (root / name).read_bytes()
        if digest(blob) != records[name]['sha256'] or digest(blob) != review['inputs'][name]:
            raise ValueError(f'Native input fingerprint mismatch: {name}')
        inputs[name] = json.loads(blob)
    skills = inputs['native-skill-contract.json']
    systems = reviewed_rows(skills['systems'], review['systems'], 'id')
    activations = reviewed_rows(skills['activations'], review['activations'], 'activationId')
    if set(systems) != set(range(1, 101)) or set(activations) != set(range(1, 210)):
        raise ValueError('P3 skill domain changed')
    if not review.get('specialRuleCn') or not review.get('specialRuleEvidence'):
        raise ValueError('Missing torso-copy rule review')
    probe = Path(icon_probe)
    run = load(probe / 'run.json')
    if run['returnCode'] != 0 or digest((probe / 'result.json').read_bytes()) != run['resultSha256']:
        raise ValueError('Invalid icon probe result')
    if (probe / 'stderr.txt').read_bytes():
        raise ValueError('Icon probe stderr is not empty')
    icons = load(probe / 'result.json')
    expected_blob = (root / 'armor-pixels-v1/result.json').read_bytes()
    if digest(expected_blob) != records['armor-pixels-v1/result.json']['sha256']:
        raise ValueError('Native icon reference fingerprint mismatch')
    expected = json.loads(expected_blob)
    if icons['source'] != expected['source']:
        raise ValueError('Icon source changed')
    expected_icons = {(r['type'], r['rarity']): r for r in expected['icons']}
    actual_icons = {(r['type'], r['rarity']): r for r in icons['icons']}
    if actual_icons.keys() != expected_icons.keys() or len(icons['icons']) != len(actual_icons):
        raise ValueError('Incomplete or duplicate armor icons')
    for key, row in actual_icons.items():
        if {k: v for k, v in row.items() if k != 'pngBase64'} != expected_icons[key]:
            raise ValueError(f'Icon mapping changed: {key}')
        png = base64.b64decode(row['pngBase64'], validate=True)
        rgba = verify_png(png)
        if digest(rgba) != row['rgbaSha256'] or not any(rgba[3::4]):
            raise ValueError(f'Icon pixel mismatch: {key}')
    return inputs, review, systems, activations, actual_icons
