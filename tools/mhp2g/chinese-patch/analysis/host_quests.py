"""Text-only quest envelope/list parsing; original quest binaries stay on host."""
from pathlib import Path


def quest_record(blob, record, namespace):
    require(0 <= record <= len(blob) - 48 and record % 4 == 0, 'Quest record bounds')
    meta = u32(blob, record + 20)
    require(meta % 4 == 0 and 0 < meta <= len(blob) - 4, 'Quest text metadata pointer')
    pointer = u32(blob, meta)
    require(pointer % 4 == 0 and 0 < pointer <= meta - 24, 'Quest six-text index bounds')
    quest_id = struct.unpack_from('<H', blob, record + 24)[0]
    units, bindings = {}, []
    for index, field in enumerate(('name', 'goal', 'failure', 'description', 'monsters', 'client')):
        slot = pointer + index * 4
        row = cstring(blob, u32(blob, slot), len(blob))
        key = f'{namespace}:offset:{row["offset"]}:utf8'
        units[key] = dict(**row, controls=control_tokens(row['text']), lines=row['text'].count('\n') + 1)
        bindings.append(dict(key=f'{namespace}:record:{record}:field:{field}', unit=key,
                             questId=quest_id, field=field, pointerOffset=slot,
                             pointerSha256=sha256(blob[slot:slot + 4]), consumerStatus='unconfirmed'))
    return dict(questId=quest_id, recordOffset=record, recordSha256=sha256(blob[record:record + 48]),
                units=units, bindings=bindings)


def quests(config, substitution):
    inventory = config['inventory']
    require(inventory['isoSha256'] == config['expected']['isoSha256'], 'Inventory ISO mismatch')
    root, results = Path(inventory['expanded']), []
    with (root / 'PSP_GAME/USRDIR/DATA.BIN').open('rb') as file:
        for member in config['members']:
            entry = inventory['data']['members'][member]
            require(entry['member'] == member and entry['bytes'] <= 1024 * 1024, 'Quest member bound')
            file.seek(entry['offset'])
            raw = file.read(entry['bytes'])
            require(sha256(raw) == entry['storedSha256'], 'Quest stored hash mismatch')
            blob = decode_member(raw, entry['lba'], substitution)
            result = dict(member=member, storedSha256=entry['storedSha256'], decodedSha256=sha256(blob))
            try:
                if config.get('queries', {}).get('layout') == 'list':
                    records, pointers = [], []
                    for at in range(0, min(len(blob), 4096), 4):
                        pointer = u32(blob, at)
                        if pointer == 0:
                            require(pointers and all(p >= at + 4 for p in pointers), 'Quest list overlaps index')
                            break
                        pointers.append(pointer)
                    else:
                        raise ValueError('Unterminated quest list')
                    for pointer in pointers:
                        records.append(quest_record(blob, pointer, f'data:{member}'))
                    result.update(layout='quest-list', records=records)
                else:
                    payload = quest_payload(blob)
                    result.update(layout='quest-envelope', payloadSha256=sha256(payload), payloadBytes=len(payload),
                                  records=[quest_record(payload, u32(payload, 0), f'data:{member}:quest-payload')])
                result['status'] = 'text-structure-parsed'
            except (ValueError, UnicodeError) as error:
                result.update(status='unsupported', error=str(error))
            results.append(result)
    return dict(schema='p2g-quest-text-analysis-v1', isoSha256=inventory['isoSha256'], members=results,
                summary=dict(members=len(results), parsed=sum(r['status'] == 'text-structure-parsed' for r in results),
                             records=sum(len(r.get('records', [])) for r in results),
                             bindings=sum(len(q['bindings']) for r in results for q in r.get('records', [])),
                             failures=[dict(member=r['member'], error=r['error']) for r in results if 'error' in r]))
