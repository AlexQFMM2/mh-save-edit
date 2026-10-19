#!/usr/bin/env python3
"""Reconcile private analysis runs without overstating text/scene coverage."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_run(path):
    raw = path.read_bytes()
    run = json.loads(path.with_name('run.json').read_text())
    require(run['returnCode'] == 0 and sha(raw) == run['resultSha256'], f'Changed/failed run: {path}')
    return json.loads(raw)


def descendants(node):
    yield node
    for child in node.get('children', []):
        yield from descendants(child)


def checked_unit(unit):
    raw = unit['text'].encode('utf-8')
    require(unit['encoding'] == 'utf-8' and sha(raw) == unit['sha256'] and
            len(raw) == unit['bytes'], 'Source string/encoding hash mismatch')


def shared_quest_bindings(mission, record, units, source):
    """Share only six complete fields with the same native quest identity."""
    require(mission['questId'] == record['questId'], 'Mission/list identity differs')
    expected = {'name', 'goal', 'failure', 'description', 'monsters', 'client'}
    for item in (mission, record):
        require(len(item['bindings']) == 6 and {b['field'] for b in item['bindings']} == expected,
                'Missing/duplicate quest text field')
        require(all(b['questId'] == item['questId'] for b in item['bindings']),
                'Quest binding identity differs')
    fields = {b['field']: b for b in mission['bindings']}
    shared = []
    for binding in record['bindings']:
        canonical = fields[binding['field']]['unit']
        physical = record['units'][binding['unit']]
        checked_unit(physical)
        checked_unit(units[canonical])
        require(physical['text'] == units[canonical]['text'] and
                physical['sha256'] == units[canonical]['sha256'], 'Mission/list text differs')
        shared.append((dict(binding, physicalSource=dict(source, offset=physical['offset'],
                       bytes=physical['bytes'], sha256=physical['sha256'])), canonical))
    return shared


def audit(args):
    paths = {name: getattr(args, name) for name in ('inventory', 'texts', 'resources', 'quests', 'quest_lists')}
    runs = {name: read_run(path) for name, path in paths.items()}
    inventory, texts, resources = (runs[name] for name in ('inventory', 'texts', 'resources'))
    version = inventory['isoSha256']
    require(all(r['isoSha256'] == version for r in runs.values()), 'Mixed ISO versions')
    expected = {r['member']: r for r in inventory['data']['members']}
    for name in ('texts', 'resources'):
        records = runs[name]['records']
        require(len(records) == len(expected) and {r['member'] for r in records} == set(expected),
                f'Incomplete/duplicate member denominator: {name}')
    native = json.loads(args.native.read_text())
    native_manifest = json.loads(args.native.with_name('manifest.json').read_text())
    require(sha(args.native.read_bytes()) == native_manifest['files'][args.native.name]['sha256'],
            'Changed native snapshot')
    require(native['isoSha256'] == version, 'Native snapshot ISO mismatch')
    unit_index, bindings, member_counts = {}, {}, {}

    def add_unit(key, unit, source):
        checked_unit(unit)
        value = dict(**unit, source=source, sourceVersion=version)
        require(key not in unit_index or unit_index[key] == value, 'Conflicting shared unit')
        unit_index[key] = value

    def add_binding(binding, canonical=None):
        key = binding['key']
        require(key not in bindings, f'Duplicate native binding: {key}')
        value = dict(binding)
        if canonical:
            value['physicalUnit'] = value['unit']
            value['unit'] = canonical
        require(value['unit'] in unit_index, 'Dangling binding')
        bindings[key] = value

    for record in texts['records']:
        member = record['member']
        require(record['storedSha256'] == expected[member]['storedSha256'], 'Member stored hash mismatch')
        for key, unit in record.get('units', {}).items():
            require(0 <= unit['offset'] < unit['offset'] + unit['bytes'] + 1 <= record['bytes'], 'Unit range')
            add_unit(key, unit, dict(member=member, decodedSha256=record['decodedSha256']))
        for binding in record.get('bindings', []):
            add_binding(binding)
        member_counts[member] = len(record.get('bindings', []))
    checked = 0
    for table in native['tables']:
        for row in table['rows']:
            binding = bindings[f'data:15:table:{table["tableId"]}:index:{row["index"]}']
            unit = unit_index[binding['unit']]
            require(unit['offset'] == row['pointer'] and unit['text'] == row['text'], 'Core regression mismatch')
            checked += 1

    missions = {}
    for member in runs['quests']['members']:
        require(member['status'] == 'text-structure-parsed', 'Unparsed mission envelope')
        require(member['storedSha256'] == expected[member['member']]['storedSha256'], 'Mission source mismatch')
        for record in member['records']:
            require(record['questId'] not in missions, 'Duplicate mission identity')
            missions[record['questId']] = record
            for key, unit in record['units'].items():
                add_unit(key, unit, dict(member=member['member'], payloadSha256=member['payloadSha256'],
                                         decodedSha256=member['decodedSha256']))
            for binding in record['bindings']:
                add_binding(binding)
            member_counts[member['member']] = len(record['bindings'])
    shared_fields, list_records = 0, 0
    for member in runs['quest_lists']['members']:
        require(member['status'] == 'text-structure-parsed', 'Unparsed quest list')
        require(member['storedSha256'] == expected[member['member']]['storedSha256'], 'Quest-list source mismatch')
        count = 0
        for record in member['records']:
            list_records += 1
            require(record['questId'] in missions, 'Quest list has no verified mission identity')
            mission = missions[record['questId']]
            for binding, canonical in shared_quest_bindings(mission, record, unit_index,
                    dict(member=member['member'], decodedSha256=member['decodedSha256'])):
                add_binding(binding, canonical)
                shared_fields += 1
                count += 1
        member_counts[member['member']] = count

    images, unknowns, coverage = [], [], []
    text_by_member = {r['member']: r for r in texts['records']}
    for resource in resources['records']:
        member = resource['member']
        tr = text_by_member[member]
        if resource['status'] == 'plaintext-unparsed':
            require(resource['sha256'] == expected[member]['storedSha256'], 'Plaintext source hash differs')
        if 'decodedSha256' in tr:
            # Plaintext exceptions were deliberately examined in both views by
            # the first-pass scanner; do not equate its decoded candidate view.
            if resource['status'] != 'plaintext-unparsed':
                require(resource['sha256'] == tr['decodedSha256'], 'Decoded resource hash differs')
        nodes = list(descendants(resource))
        unknown_start = len(unknowns)
        for node in nodes:
            for picture in node.get('pictures', []):
                images.append(dict(resource=node['key'], member=member, resourceOffset=node['offset'],
                                   resourceSha256=node['sha256'], **picture))
            if node['status'] in ('unparsed', 'unparsed-depth-limit', 'unsupported-texture', 'plaintext-unparsed'):
                if node['key'] == f'data:{member}' and member_counts.get(member):
                    continue
                unknowns.append(dict(resource=node['key'], member=member, status=node['status'],
                                     candidates=node.get('candidates', []), bytes=node.get('bytes'),
                                     nextAction='Validate format and consumer; no-text status is not inferred.'))
        coverage.append(dict(member=member, directoryIndexed=True, structureStatus=resource['status'],
                             textReferences=member_counts.get(member, 0),
                             imageCount=sum(len(n.get('pictures', [])) for n in nodes),
                             unresolvedNodes=len(unknowns) - unknown_start,
                             stringCandidateTruncated=tr.get('strings', {}).get('truncated', False),
                             callerBindingStatus='not-evaluated-by-structural-audit',
                             translationStatus='not-evaluated', displayStatus='not-evaluated'))
    summary = dict(files=len(inventory['files']), members=len(expected), nestedNodes=resources['summary']['nodes'],
                   coreRegressionRows=checked, canonicalTextUnits=len(unit_index), physicalBindings=len(bindings),
                   missionRecords=len(missions), listRecords=list_records, sharedQuestFields=shared_fields,
                   textureResources=resources['summary']['states'].get('texture-indexed', 0),
                   pictures=len(images), unresolvedNodes=len(unknowns),
                   fullAnalysisComplete=False, imageTextReviewed=False, batchReplacementAllowed=False)
    outputs = {'text-index.json': dict(schema='p2g-analysis-text-index-v1', sourceVersion=version,
                                      units=unit_index, bindings=bindings),
               'coverage.json': dict(schema='p2g-analysis-coverage-v1', summary=summary,
                                     files=inventory['files'], members=coverage),
               'image-index.json': dict(schema='p2g-analysis-image-index-v1', pictures=images),
               'unresolved.json': dict(schema='p2g-analysis-unresolved-v1', resources=unknowns,
                   sceneGaps=['Title NEW GAME control source and texture/layout binding',
                              'NPC actor, progress branches and page sequence',
                              'Other scene/consumer bindings; program strings and dynamic assembly',
                              'Image text, video text, GIM/PNG and external system dialogs'],
                   sceneEvidenceStatus='Separate static scene evidence is not merged by this structural audit; '
                                       'it does not reset prior display acceptance.')}
    out = args.output.resolve()
    require(not out.exists(), 'Refusing to overwrite audit')
    repo = Path(__file__).resolve().parents[4]
    require(out.is_relative_to(repo.parent / 'research') or
            subprocess.run(['git', 'check-ignore', '--quiet', str(out)], cwd=repo).returncode == 0,
            'Audit output must be private')
    out.mkdir(parents=True)
    hashes = {}
    for name, value in outputs.items():
        data = (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()
        (out / name).write_bytes(data)
        hashes[name] = sha(data)
    manifest = dict(schema='p2g-analysis-audit-run-v1', inputs={str(p): sha(p.read_bytes()) for p in
                    [*paths.values(), args.native]}, outputs=hashes, toolSha256=sha(Path(__file__).read_bytes()), summary=summary)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('inventory', 'texts', 'resources', 'quests', 'quest-lists', 'native', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    audit(parser.parse_args())
