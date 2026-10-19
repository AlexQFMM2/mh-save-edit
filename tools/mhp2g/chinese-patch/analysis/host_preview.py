"""Explicitly approved, bounded in-memory crops; no host writes or full atlases."""
from pathlib import Path


def preview(config, substitution):
    inventory, requests = config['inventory'], config['queries']
    require(config.get('previewApproved') is True, 'Texture conversion requires explicit authorization')
    require(inventory['isoSha256'] == config['expected']['isoSha256'], 'Inventory ISO mismatch')
    require(1 <= len(requests) <= 2, 'At most two approved crops per run')
    root, results = Path(inventory['expanded']), []
    for request in requests:
        member, picture = request['member'], request['picture']
        entry = inventory['data']['members'][member]
        require(entry['member'] == member and entry['bytes'] <= 1024 * 1024, 'Preview source bound')
        with (root / 'PSP_GAME/USRDIR/DATA.BIN').open('rb') as file:
            file.seek(entry['offset'])
            raw = file.read(entry['bytes'])
        require(sha256(raw) == entry['storedSha256'], 'Preview source hash mismatch')
        blob = decode_member(raw, entry['lba'], substitution)
        index = tmh_index(blob)
        require(0 <= picture < len(index['pictures']), 'Picture index')
        record = index['pictures'][picture]
        require(record['recordSha256'] == request['recordSha256'], 'Picture fingerprint mismatch')
        x, y, width, height = request['rectangle']
        require(0 < width <= 256 and 0 < height <= 64 and width * height <= record['width'] * record['height'] // 4,
                'Crop area limit; full atlases are not exported')
        pixels = crop_tinted(tmh_pictures(blob)[picture], (x, y, width, height), [255, 255, 255])
        png = encode_png(width, height, pixels)
        require(len(png) <= 128 * 1024, 'Preview PNG size limit')
        results.append(dict(**request, sourceSha256=sha256(blob), pngSha256=sha256(png),
                            png=base64.b64encode(png).decode('ascii')))
    return dict(schema='p2g-approved-texture-crops-v1', results=results,
                summary=dict(crops=len(results), hostWrites=0, originalAtlasesExported=0))
