"""Nested resource directories and texture metadata, with no image conversion."""
import sys
from collections import Counter
from pathlib import Path


def resource_tree(blob, offset=0, key='root', depth=0):
    result = dict(key=key, offset=offset, bytes=len(blob), sha256=sha256(blob),
                  candidates=signatures(blob[:1024], len(blob)))
    if blob.startswith(b'.TMH'):
        try:
            result.update(tmh_index(blob), status='texture-indexed')
        except ValueError as error:
            result.update(status='unsupported-texture', error=str(error))
    elif blob.startswith(b'MWo3'):
        result.update(status='overlay-indexed', name=blob[32:64].split(b'\0')[0].decode('ascii'),
                      base=u32(blob, 8), headerWords=[u32(blob, p) for p in range(0, 32, 4)])
    elif depth < 4:
        try:
            entries = archive_members(blob)
            children = [resource_tree(blob[r['offset']:r['offset'] + r['bytes']],
                                      offset + r['offset'], f'{key}/{r["index"]}', depth + 1)
                        if r['bytes'] else dict(key=f'{key}/{r["index"]}', status='empty-slot') for r in entries]
            result.update(status='archive-directory-parsed', children=children, directory=entries)
        except ValueError:
            result.update(status='unparsed')
    else:
        result.update(status='unparsed-depth-limit')
    return result


def resources(config, substitution):
    inventory = config['inventory']
    require(inventory['isoSha256'] == config['expected']['isoSha256'], 'Inventory ISO mismatch')
    root, results = Path(inventory['expanded']), []
    exceptions = set(config['plaintextExceptions'])
    with (root / 'PSP_GAME/USRDIR/DATA.BIN').open('rb') as file:
        for entry in inventory['data']['members']:
            member = entry['member']
            if member % 500 == 0:
                print(f'Indexed member {member}/{len(inventory["data"]["members"])}', file=sys.stderr, flush=True)
            file.seek(entry['offset'])
            raw = file.read(entry['bytes'])
            require(sha256(raw) == entry['storedSha256'], 'Resource input mismatch')
            if member in exceptions:
                result = dict(key=f'data:{member}', bytes=len(raw), sha256=sha256(raw),
                              status='plaintext-unparsed', candidates=signatures(raw[:1024], len(raw)))
            else:
                blob = decode_member(raw, entry['lba'], substitution)
                result = resource_tree(blob, key=f'data:{member}')
            result['member'] = member
            results.append(result)

    def descendants(row):
        yield row
        for child in row.get('children', []):
            yield from descendants(child)
    nodes = [n for r in results for n in descendants(r)]
    return dict(schema='p2g-resource-structure-v1', isoSha256=inventory['isoSha256'], records=results,
                summary=dict(members=len(results), nodes=len(nodes), states=dict(Counter(r['status'] for r in nodes)),
                             pictures=sum(len(r.get('pictures', [])) for r in nodes),
                             textInImagesConfirmed=0))
