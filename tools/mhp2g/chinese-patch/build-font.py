#!/usr/bin/env python3
"""Build a private, reproducible PGF subset and verify every encoded bitmap."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import zlib
from email.parser import Parser
import PIL
import fontTools
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from pgf_codec import encode_pgf, decode_pgf


SOURCE_SHA256 = 'b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a'


def build(font_path, face_index, characters, output, pixels=16,
          license_path=Path('/usr/share/doc/fonts-noto-cjk/copyright')):
    if output.exists():
        raise ValueError('Use a new output directory')
    codes = json.loads(characters.read_text())['codepoints']
    if codes != sorted(set(codes)) or not codes:
        raise ValueError('Invalid character set')
    if hashlib.sha256(font_path.read_bytes()).hexdigest() != SOURCE_SHA256 or face_index != 2:
        raise ValueError('Source differs from the reviewed Noto Sans CJK SC Regular face')
    if not 8 <= pixels <= 20:
        raise ValueError('Pixel size exceeds the pilot build range')
    paragraphs = [Parser().parsestr(p) for p in license_path.read_text().split('\n\n')]
    license_text = next((p['License'] for p in paragraphs if
                         p['License'] and p['License'].startswith('SIL-1.1\n')), None)
    if not license_text or 'SIL OPEN FONT LICENSE Version 1.1' not in license_text:
        raise ValueError('Missing OFL license')
    license_text = '\n'.join('' if line.strip()=='.' else line.lstrip()
                             for line in license_text.splitlines()[1:])+'\n'
    with TTFont(font_path, fontNumber=face_index) as face:
        cmap = face.getBestCmap()
        copyright_text = face['name'].getDebugName(0)
        if any(code not in cmap for code in codes):
            raise ValueError('Source font is missing required glyphs')
    font = ImageFont.truetype(str(font_path), pixels, index=face_index)
    glyphs = {}
    for code in codes:
        mask, (left, y) = font.getmask2(chr(code), mode='L', anchor='ls')
        glyphs[code] = dict(width=mask.size[0], height=mask.size[1], left=left, top=-y,
                           advance=round(font.getlength(chr(code))*64), pixels=[(v*15+127)//255 for v in mask])
    data = encode_pgf(glyphs, pixels)
    if decode_pgf(data) != glyphs:
        raise ValueError('PGF bitmap/metric roundtrip mismatch')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.p2g-font-', dir=output.parent))
    try:
        (temporary/'zh-cn.pgf').write_bytes(data)
        (temporary/'OFL.txt').write_text('P2G Project Sans\nDerived from Noto Sans CJK SC Regular.\n'+copyright_text+'\n\n'+license_text)
        columns, cell = 16, 40
        sheet = Image.new('RGB', (columns*cell, ((len(codes)+columns-1)//columns)*cell), 'white')
        draw = ImageDraw.Draw(sheet)
        for i, code in enumerate(codes):
            g = glyphs[code]
            bitmap = Image.new('L', (g['width'], g['height']))
            bitmap.putdata([255-v*17 for v in g['pixels']])
            sheet.paste(bitmap, ((i%columns)*cell+4, (i//columns)*cell+2))
            draw.text(((i%columns)*cell+2, (i//columns)*cell+24), f'{code:04X}', fill='black')
        sheet.save(temporary/'glyph-review.png')
        report = dict(schema='p2g-pgf-build-v1', fontSourceSha256=hashlib.sha256(font_path.read_bytes()).hexdigest(),
                      sourceFace=face_index, sourceFamily=font.getname(), pixels=pixels, pillow=PIL.__version__,
                      fontTools=fontTools.__version__, freeType=ImageFont.core.freetype2_version,
                      charactersSha256=hashlib.sha256(characters.read_bytes()).hexdigest(),
                      licenseSourceSha256=hashlib.sha256(license_path.read_bytes()).hexdigest(),
                      pgfSha256=hashlib.sha256(data).hexdigest(), bytes=len(data), codepoints=codes,
                      metrics={str(code): dict(**{k:v for k,v in g.items() if k!='pixels'},
                        bitmapCrc32=zlib.crc32(bytes(g['pixels'][y*g['width']+x]*17
                          if x<g['width'] and y<g['height'] else 0 for y in range(32) for x in range(32))))
                        for code,g in glyphs.items()},
                      runtimeAccepted=False)
        (temporary/'font.json').write_text(json.dumps(report, indent=2)+'\n')
        temporary.rename(output)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return dict(output=str(output), bytes=len(data), glyphs=len(codes))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font', type=Path, required=True)
    parser.add_argument('--face', type=int, default=2)
    parser.add_argument('--characters', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--pixels', type=int, default=16)
    parser.add_argument('--license', type=Path, default=Path('/usr/share/doc/fonts-noto-cjk/copyright'))
    args = parser.parse_args()
    print(json.dumps(build(args.font, args.face, args.characters, args.output, args.pixels, args.license)))
