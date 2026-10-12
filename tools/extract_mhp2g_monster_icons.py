#!/usr/bin/env python3
"""Create a private P2G monster icon snapshot using read-only host access."""
import argparse
import ast
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--game-root', required=True, help='Pinned Japanese expanded game directory')
    parser.add_argument('--cipher-reference', type=Path, required=True)
    parser.add_argument('--toc', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True, help='New private output directory')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output exists; refusing to overwrite')
    reference = args.cipher_reference.read_bytes()
    reference_sha = hashlib.sha256(reference).hexdigest()
    if reference_sha != 'e961029e1f37c70879142a6c94cd76b32d36aa7ac9803517576a80be1cab7d69':
        parser.error('Cipher reference fingerprint mismatch')
    cipher = next(node for node in ast.parse(reference).body
                  if isinstance(node, ast.ClassDef) and node.name == 'DataCipher')
    table = next(ast.literal_eval(node.value) for node in cipher.body if isinstance(node, ast.Assign)
                 and any(isinstance(target, ast.Name) and target.id == '_decode_table' for target in node.targets))
    toc = json.loads(args.toc.read_text())['entries']
    directory = Path(__file__).parent / 'mhp2g'
    codec_source = (directory / 'native_item_icons.py').read_text()
    source = (directory / 'native_monster_icons.py').read_text()
    # Execute our two small source modules in memory; no host files are written.
    command = 'import types, json\ncodec=types.ModuleType("p2g_codec")\n'
    command += 'exec(' + repr(codec_source) + ', codec.__dict__)\n' + source
    command += '\nprint(json.dumps(extract_monster_icons(' + repr(args.game_root)
    command += ', ' + repr(table) + ', ' + repr(toc) + ', codec)))\n'
    response = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '--', args.host, 'python -'],
                              input=command, text=True, encoding='utf8', capture_output=True, timeout=90, check=True)
    manifest = json.loads(response.stdout)
    files = manifest.pop('files')
    manifest['source'].update(host=args.host, cipherReferenceSha256=reference_sha,
                              tocReferenceSha256=hashlib.sha256(args.toc.read_bytes()).hexdigest(),
                              extractorSha256=hashlib.sha256(source.encode()).hexdigest(),
                              codecSha256=hashlib.sha256(codec_source.encode()).hexdigest())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.p2g-monster-icons-', dir=args.output.parent))
    try:
        (temporary / 'icons').mkdir()
        for sha, encoded in files.items():
            png = base64.b64decode(encoded, validate=True)
            if hashlib.sha256(png).hexdigest() != sha:
                raise ValueError('PNG transfer checksum mismatch')
            (temporary / 'icons' / f'{sha}.png').write_bytes(png)
        (temporary / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        if args.output.exists():
            raise FileExistsError(args.output)
        temporary.rename(args.output)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    print(json.dumps(dict(status='extracted', monsters=len(manifest['monsters']), pngs=len(files),
                         unrepresented=manifest['unrepresented'], output=str(args.output))))


if __name__ == '__main__':
    main()
