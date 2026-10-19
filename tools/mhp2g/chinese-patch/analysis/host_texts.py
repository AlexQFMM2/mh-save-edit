"""Read and structurally index text candidates. Never assumes every member is text."""
import re
from collections import Counter
from pathlib import Path


def control_tokens(text):
    return [dict(offset=m.start(), value=m.group()) for m in re.finditer(
        r'%[-+ #0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:[hlL])?[a-zA-Z%]|'
        r'~[A-Za-z][0-9A-Za-z]*|\\[A-Za-z][^\s\\]*|[\x01-\x1f\x7f]|[\ue000-\uf8ff]', text)]


def text_resource(blob, namespace):
    kind, directory = text_directory(blob)
    tables, units, bindings = [], {}, []
    for entry in directory:
        errors, rows, layout = [], None, None
        for parser, name in ((pointer_strings, 'relative-u32-sentinel'),
                             (flagged_strings, 'flag-relative-u32')):
            try:
                rows = parser(blob, entry['offset'], entry['limit'])
                layout = name
                break
            except (ValueError, UnicodeError) as error:
                errors.append(dict(layout=name, reason=str(error)))
        table = dict(**entry, layout=layout, status='parsed-structure' if rows is not None else 'unsupported',
                     rows=len(rows) if rows is not None else None)
        if rows is None:
            table['errors'] = errors
            table['prefixWords'] = [u32(blob, at) for at in
                range(entry['offset'], min(entry['limit'] - 3, entry['offset'] + 48), 4)]
        else:
            for row in rows:
                unit_key = f'{namespace}:offset:{row["offset"]}:utf8'
                unit = {k: row[k] for k in ('offset', 'bytes', 'sha256', 'text', 'encoding')}
                unit.update(controls=control_tokens(row['text']), lines=row['text'].count('\n') + 1)
                require(unit_key not in units or units[unit_key] == unit, 'Conflicting shared string')
                units[unit_key] = unit
                bindings.append(dict(key=f'{namespace}:table:{entry["table"]}:index:{row["index"]}',
                                     unit=unit_key, table=entry['table'], index=row['index'],
                                     pointerOffset=row['pointerOffset'],
                                     pointerSha256=sha256(blob[row['pointerOffset']:row['pointerOffset'] + 4]),
                                     flag=row.get('flag'), consumerStatus='unconfirmed'))
        tables.append(table)
    return dict(directoryKind=kind, tables=tables, units=units, bindings=bindings)


def string_candidates(blob, maximum=3000):
    rows, total = [], 0
    start = 0
    # A linear scan avoids quadratic regex backtracking on long binary spans.
    for end, value in enumerate(blob):
        if value != 0:
            continue
        at, start = start, end + 1
        if not 3 <= end - at <= 16384:
            continue
        raw = blob[at:end]
        if any(c < 32 and c not in (9, 10, 13) for c in raw):
            continue
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError:
            continue
        if not (sum('\u3040' <= c <= '\u9fff' for c in text) >= 2 or
                text.upper() in ('NEW GAME', 'CONTINUE', 'OPTIONS')):
            continue
        total += 1
        if len(rows) < maximum:
            rows.append(dict(offset=at, bytes=len(raw), sha256=sha256(raw),
                             encoding='utf-8', text=text, status='candidate-unbound'))
    return dict(total=total, truncated=total > len(rows), rows=rows)


def texts(config, substitution):
    inventory = config['inventory']
    require(inventory['isoSha256'] == config['expected']['isoSha256'], 'Inventory ISO mismatch')
    root = Path(inventory['expanded'])
    by_id = {r['member']: r for r in inventory['data']['members']}
    members = config.get('members', list(by_id))
    records = []
    with (root / 'PSP_GAME/USRDIR/DATA.BIN').open('rb') as file:
        for member in members:
            row = by_id[member]
            result = dict(member=member, storedSha256=row['storedSha256'], bytes=row['bytes'])
            file.seek(row['offset'])
            raw = file.read(row['bytes'])
            require(len(raw) == row['bytes'] and sha256(raw) == row['storedSha256'], 'Member input mismatch')
            # Raw PSMF has a verified header. Other members retain both views as candidates.
            if row['storedCandidates'] == ['psmf']:
                result.update(status='video-container-unparsed', format='psmf')
                records.append(result)
                continue
            require(row['bytes'] <= 16 * 1024 * 1024, 'Unexpected large non-video member')
            blob = decode_member(raw, row['lba'], substitution)
            namespace = f'data:{member}'
            result.update(decodedSha256=sha256(blob), namespace=namespace,
                          decodedCandidates=signatures(blob[:1024], len(blob)))
            try:
                result.update(text_resource(blob, namespace))
                result['status'] = 'structure-parsed-with-gaps'
            except (ValueError, UnicodeError) as error:
                result.update(status='unsupported', structuralError=str(error))
            result['strings'] = string_candidates(blob)
            if not result.get('bindings'):
                result['storedStrings'] = string_candidates(raw, maximum=100)
            records.append(result)
    return dict(schema='p2g-text-analysis-v1', isoSha256=inventory['isoSha256'], records=records,
                summary=dict(members=len(records), states=dict(Counter(r['status'] for r in records)),
                             units=sum(len(r.get('units', {})) for r in records),
                             bindings=sum(len(r.get('bindings', [])) for r in records),
                             candidates=sum(r.get('strings', {}).get('total', 0) for r in records)))
