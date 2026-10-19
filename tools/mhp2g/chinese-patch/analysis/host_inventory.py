"""Executed via SSH stdin; all host files are opened read-only."""
import os
from collections import Counter
from pathlib import Path


def inventory(config, substitution):
    root = Path(config['root'])
    require(root.is_dir() and not root.is_symlink(), 'Missing/linked source root')
    isos = list(root.glob('*.iso'))
    require(len(isos) == 1, 'Expected exactly one ISO')
    iso, expanded = isos[0], isos[0].with_suffix('')
    require(expanded.is_dir() and not expanded.is_symlink(), 'Missing/linked expanded root')
    expected = config['expected']

    def stream_hash(file, size):
        digest, remaining = hashlib.sha256(), size
        while remaining:
            block = file.read(min(1024 * 1024, remaining))
            require(block, 'Short source read')
            digest.update(block)
            remaining -= len(block)
        return digest.hexdigest()

    iso_bytes = iso.stat().st_size
    require(iso_bytes == expected['isoBytes'], 'ISO size mismatch')
    with iso.open('rb') as source:
        iso_hash = stream_hash(source, iso_bytes)
        require(iso_hash == expected['isoSha256'], 'ISO hash mismatch')

        def read_at(at, size):
            require(0 <= at <= iso_bytes and 0 <= size <= 4 * 1024 * 1024 and
                    at + size <= iso_bytes, 'ISO bounded read')
            source.seek(at)
            result = source.read(size)
            require(len(result) == size, 'Short ISO read')
            return result

        entries = iso_catalog(read_at, iso_bytes)
        files = []
        for row in entries:
            target = expanded / row['path']
            require(not target.is_symlink(), 'Linked expanded entry')
            if row['directory']:
                require(target.is_dir(), 'Expanded directory missing')
                continue
            require(target.is_file() and target.stat().st_size == row['bytes'],
                    f'Expanded file size mismatch: {row["path"]}')
            source.seek(row['offset'])
            digest = stream_hash(source, row['bytes'])
            with target.open('rb') as f:
                expanded_hash = stream_hash(f, row['bytes'])
            require(digest == expanded_hash, f'Expanded/ISO mismatch: {row["path"]}')
            files.append(dict(**row, sha256=digest, expandedMatchesIso=True))
        observed = []
        for parent, dirs, names in os.walk(expanded):
            require(not any((Path(parent) / n).is_symlink() for n in dirs + names),
                    'Linked expanded tree entry')
            observed.extend((Path(parent) / n).relative_to(expanded).as_posix() for n in names)
            require(len(observed) <= 4096, 'Expanded file count limit')
        require(set(observed) == {r['path'] for r in files}, 'Extra/missing expanded files')

    by_path = {r['path']: r for r in files}
    require(by_path['PSP_GAME/SYSDIR/BOOT.BIN']['sha256'] == expected['boot']['sha256'],
            'BOOT provenance mismatch')
    data_path = expanded / 'PSP_GAME/USRDIR/DATA.BIN'
    data_bytes = data_path.stat().st_size
    with data_path.open('rb') as data:
        first = u32(decode_member(data.read(4), 0, substitution), 0)
        require(1 <= first <= 512, 'TOC sector count')
        data.seek(0)
        toc_raw = data.read(first * 2048)
        toc = data_directory(decode_member(toc_raw, 0, substitution), data_bytes)
        require(sha256(toc_raw) == expected['data']['tocSha256'], 'TOC provenance mismatch')
        members = []
        for index, (lo, hi) in enumerate(zip(toc, toc[1:])):
            size = (hi - lo) * 2048
            data.seek(lo * 2048)
            prefix = data.read(min(size, 1024))
            data.seek(lo * 2048)
            encrypted_hash = stream_hash(data, size)
            decoded = decode_member(prefix, lo, substitution)
            members.append(dict(member=index, offset=lo * 2048, lba=lo, bytes=size,
                                storedSha256=encrypted_hash,
                                storedPrefixHex=prefix[:16].hex(), decodedPrefixHex=decoded[:16].hex(),
                                storedCandidates=signatures(prefix, size),
                                decodedCandidates=signatures(decoded, size),
                                status='empty' if not size else 'unparsed'))
    require(len(members) == expected['data']['members'], 'Member count mismatch')
    return dict(schema='p2g-resource-inventory-v1', iso=str(iso), expanded=str(expanded),
                isoBytes=iso_bytes, isoSha256=iso_hash, disc=expected['disc'],
                files=files, directories=[r for r in entries if r['directory']],
                data=dict(bytes=data_bytes, sha256=by_path['PSP_GAME/USRDIR/DATA.BIN']['sha256'],
                          tocSha256=sha256(toc_raw), tocBytes=len(toc_raw), members=members),
                summary=dict(files=len(files), members=len(members),
                             emptyMembers=sum(not r['bytes'] for r in members),
                             decodedCandidates=dict(Counter(c for r in members for c in r['decodedCandidates'])),
                             storedCandidates=dict(Counter(c for r in members for c in r['storedCandidates']))))
