#!/usr/bin/env python3
"""Create a private P2G icon snapshot via read-only SSH; requires pinned research inputs."""
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
    parser.add_argument('--game-root', required=True, help='Expanded P2G-CGCN directory on the source host')
    parser.add_argument('--cipher-reference', type=Path, required=True, help='Private pinned mhef PSP reference source')
    parser.add_argument('--toc', type=Path, required=True, help='Private pinned toc-probe.json')
    parser.add_argument('--output', type=Path, required=True, help='New private output directory')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output exists; refusing to overwrite')
    tree = ast.parse(args.cipher_reference.read_text())
    cipher = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'DataCipher')
    table = next(ast.literal_eval(node.value) for node in cipher.body if isinstance(node, ast.Assign)
                 and any(isinstance(target, ast.Name) and target.id == '_decode_table' for target in node.targets))
    toc = json.loads(args.toc.read_text())['entries']
    extractor = Path(__file__).parent / 'mhp2g' / 'native_item_icons.py'
    source = extractor.read_text()
    # Native files are read and decoded only in host memory. No host output files.
    command = source + '\nprint(json.dumps(extract(' + repr(args.game_root) + ', ' + repr(table) + ', ' + repr(toc) + ')))\n'
    response = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '--', args.host, 'python -'],
                              input=command, text=True, capture_output=True, timeout=90, check=True)
    manifest = json.loads(response.stdout)
    files = manifest.pop('files')
    manifest['source']['host'] = args.host
    manifest['source']['cipherReferenceSha256'] = hashlib.sha256(args.cipher_reference.read_bytes()).hexdigest()
    manifest['source']['tocReferenceSha256'] = hashlib.sha256(args.toc.read_bytes()).hexdigest()
    manifest['source']['extractorSha256'] = hashlib.sha256(extractor.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.p2g-icons-', dir=args.output.parent))
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
    print(json.dumps(dict(status='extracted', items=len(manifest['items']), combinations=len(manifest['icons']),
                         pngs=len(files), output=str(args.output)), ensure_ascii=False))


if __name__ == '__main__':
    main()
