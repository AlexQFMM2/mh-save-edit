"""Install only individually verified content-addressed 24×24 PNGs."""
import base64
import struct
import zlib
from pathlib import Path
from .sources import digest


def verify_png(png):
    if png[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Not a PNG')
    at = 8
    compressed = bytearray()
    kinds = []
    while at < len(png):
        size, = struct.unpack_from('>I', png, at)
        kind, data = png[at+4:at+8], png[at+8:at+8+size]
        crc, = struct.unpack_from('>I', png, at+8+size)
        if zlib.crc32(kind+data) != crc:
            raise ValueError('PNG checksum mismatch')
        if kind == b'IHDR' and struct.unpack('>IIBBBBB', data) != (24, 24, 8, 6, 0, 0, 0):
            raise ValueError('Unexpected P3 icon size or format')
        kinds.append(kind)
        if kind == b'IDAT': compressed.extend(data)
        at += size+12
    if not kinds or kinds[0] != b'IHDR' or kinds[-1] != b'IEND':
        raise ValueError('Incomplete PNG chunks')
    scanlines = zlib.decompress(compressed)
    if len(scanlines) != 24*97 or any(scanlines[y*97] != 0 for y in range(24)):
        raise ValueError('Unexpected frozen PNG scanline encoding')
    pixels = b''.join(scanlines[y*97+1:(y+1)*97] for y in range(24))
    if at != len(png):
        raise ValueError('Truncated PNG')
    return pixels


def write_icons(source, directory, items):
    directory = Path(directory)
    directory.mkdir(parents=True)
    if source['pairCount'] != 296 or source['samplePairCount'] != 296 or len(source['records']) != 296:
        raise ValueError('Incomplete icon extraction')
    if not all(source['source'][k] for k in ['pauthHeaderSha1','pauthHeaderCmac','pauthPayloadCmac','plainMatches3987']):
        raise ValueError('Unverified native texture')
    mapping = {}
    for row in source['records']:
        png = base64.b64decode(row['pngBase64'], validate=True)
        if not row['referenceAlgorithmEqual'] or len(png) != row['pngBytes'] or digest(png) != row['pngSha256']:
            raise ValueError('Icon pixel/hash verification failed')
        pixels = verify_png(png)
        histogram = {str(a):pixels[3::4].count(a) for a in set(pixels[3::4])}
        if digest(pixels) != row['rgbaSha256'] or histogram != row['alphaHistogram']:
            raise ValueError('Native icon palette/alpha changed')
        name = digest(png)+'.png'
        (directory / name).write_bytes(png)
        for id in row['items']:
            if id in mapping or list(bytes.fromhex(items[id]['recordHex'])[4:6]) != [row['iconId'], row['colorId']]:
                raise ValueError(f'Icon binding changed: {id}')
            mapping[id] = '/assets/catalog/icons/'+name
    if set(mapping) != set(range(1,979)):
        raise ValueError('Icon endpoints incomplete')
    return mapping
