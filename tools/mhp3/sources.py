"""Frozen, private P3 evidence inputs. Never connects to the game host."""
import hashlib
import json
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def frozen_probe(directory):
    directory = Path(directory)
    run = load_json(directory / 'run.json')
    if run['returnCode'] != 0 or run['failure'] is not None:
        raise ValueError(f'Unsuccessful frozen probe: {directory.name}')
    for name, field in [('query.py', 'querySha256'), ('result.json', 'resultSha256')]:
        if digest((directory / name).read_bytes()) != run[field]:
            raise ValueError(f'Frozen probe changed: {directory.name}/{name}')
    if (directory / 'stderr.txt').read_bytes():
        raise ValueError(f'Frozen probe has stderr: {directory.name}')
    return load_json(directory / 'result.json')


def native_inputs(research, icons):
    research = Path(research)
    specialist = research / 'mhp3/item-specialist-20261024'
    fields = research / 'mhp3/field-investigation-20261024'
    paths = {'items': specialist / 'item-domain-v1', 'shops': specialist / 'shop-lists-v2',
             'decorations': fields / 'item-relations-v1', 'contracts': fields / 'item-contract-v1',
             'combinations': fields / 'combination-v1', 'forge': fields / 'decoration-forge-v1',
             'icons': Path(icons)}
    return {key: frozen_probe(p) for key, p in paths.items()}, [
        {'path': str(p.resolve() / 'result.json'), 'sha256': digest((p / 'result.json').read_bytes())}
        for p in paths.values()]
