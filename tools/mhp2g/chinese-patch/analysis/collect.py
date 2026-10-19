#!/usr/bin/env python3
"""Run a read-only host query; save only versioned derived evidence locally."""
import argparse
import ast
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def require(value, message):
    if not value:
        raise ValueError(message)


def collect(args):
    require(re.fullmatch(r'[\w.-]+@[\w.-]+', args.host), 'Invalid SSH destination')
    out = args.output.resolve()
    require(not out.exists(), 'Refusing to overwrite an analysis run')
    repo = Path(__file__).resolve().parents[4]
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', str(out)], cwd=repo).returncode == 0
    research = repo.parent / 'research'
    require(ignored or out.is_relative_to(research), 'Evidence output must be private')
    native_path = args.native / 'texts.json'
    native_raw = native_path.read_bytes()
    native = json.loads(native_raw)
    manifest = json.loads((args.native / 'manifest.json').read_text())
    require(hashlib.sha256(native_raw).hexdigest() == manifest['files']['texts.json']['sha256'],
            'Native snapshot hash mismatch')
    reference = args.reference.read_bytes()
    require(hashlib.sha256(reference).hexdigest() == native['cipherReferenceSha256'], 'Cipher reference mismatch')
    cls = next(n for n in ast.parse(reference).body if isinstance(n, ast.ClassDef) and n.name == 'DataCipher')
    substitution = next(ast.literal_eval(n.value) for n in cls.body if isinstance(n, ast.Assign)
                        and any(isinstance(t, ast.Name) and t.id == '_decode_table' for t in n.targets))
    require(isinstance(substitution, bytes) and len(substitution) == len(set(substitution)) == 256,
            'Invalid literal substitution table')
    files = [repo / 'tools/mhp2g/native_item_icons.py', Path(__file__).with_name('formats.py'),
             Path(__file__).with_name('host_' + args.mode + '.py')]
    if args.mode == 'quests':
        files.insert(2, Path(__file__).with_name('host_texts.py'))
    sources = [p.read_text() for p in files]
    source_hashes = {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest()
                     for p in files + [Path(__file__)]}
    config = dict(root=args.root, expected={k: native[k] for k in
                  ('isoBytes', 'isoSha256', 'boot', 'data', 'disc', 'textContainer')})
    config['plaintextExceptions'] = next(ast.literal_eval(n.value) for n in cls.body if isinstance(n, ast.Assign)
                        and any(isinstance(t, ast.Name) and t.id == '_mhp2g_jp_exceptions' for t in n.targets))
    inputs = {str(native_path): hashlib.sha256(native_raw).hexdigest(),
              str(args.reference): hashlib.sha256(reference).hexdigest()}
    if args.inventory:
        inventory_raw = args.inventory.read_bytes()
        inventory_run = json.loads(args.inventory.with_name('run.json').read_text())
        require(inventory_run['returnCode'] == 0 and hashlib.sha256(inventory_raw).hexdigest() ==
                inventory_run['resultSha256'], 'Inventory run fingerprint mismatch')
        config['inventory'] = json.loads(inventory_raw)
        inputs[str(args.inventory)] = hashlib.sha256(inventory_raw).hexdigest()
    if args.members:
        config['members'] = [int(n) for n in args.members.split(',')]
    if args.member_range:
        require(not args.members, 'Choose members or member-range')
        start, stop = args.member_range
        require(0 <= start < stop <= 10000, 'Member range bound')
        config['members'] = list(range(start, stop))
    if args.queries:
        config['queries'] = json.loads(args.queries.read_text())
        inputs[str(args.queries)] = hashlib.sha256(args.queries.read_bytes()).hexdigest()
    if args.preview_approved:
        require(args.mode == 'preview', 'Approval flag is only for explicitly authorized previews')
        config['previewApproved'] = True
    payload = '\n'.join(sources) + '\n' + 'print(json.dumps(' + args.mode + '(' + repr(config) + ', ' + repr(substitution) + '), ensure_ascii=True))\n'
    command = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=yes']
    if args.host_key_alias:
        command += ['-o', 'HostKeyAlias=' + args.host_key_alias]
    command += [args.host, 'python -B -']
    out.mkdir(parents=True)
    # Keep the exact submitted code/config private, so later code edits cannot
    # silently change the provenance of an in-flight query.
    (out / 'query.py').write_text(payload)
    started = datetime.now(timezone.utc).isoformat()
    failure, return_code = None, None
    with (out / 'result.json').open('xb') as stdout, (out / 'stderr.txt').open('xb') as stderr:
        try:
            run = subprocess.run(command, input=payload.encode(), stdout=stdout, stderr=stderr, timeout=1800)
            return_code = run.returncode
        except (subprocess.TimeoutExpired, OSError) as error:
            failure = str(error)
    report = dict(schema='p2g-analysis-run-v1', started=started,
                  finished=datetime.now(timezone.utc).isoformat(), host=args.host, root=args.root,
                  mode=args.mode, command=command, returnCode=return_code, failure=failure, inputs=inputs,
                  sources=source_hashes,
                  payloadSha256=hashlib.sha256(payload.encode()).hexdigest(),
                  nativeSha256=hashlib.sha256(native_raw).hexdigest(), cipherReferenceSha256=native['cipherReferenceSha256'],
                  resultSha256=hashlib.sha256((out / 'result.json').read_bytes()).hexdigest())
    (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
    require(return_code == 0, 'Host query failed; see private run.json and stderr.txt')
    result = json.loads((out / 'result.json').read_text())
    print(json.dumps(dict(output=str(out), summary=result.get('summary')), ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--host-key-alias')
    parser.add_argument('--root', required=True)
    parser.add_argument('--native', type=Path, required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--mode', choices=['inventory', 'texts', 'inspect', 'quests', 'resources', 'preview'], required=True)
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--members')
    parser.add_argument('--member-range', type=int, nargs=2, metavar=('START', 'STOP'))
    parser.add_argument('--queries', type=Path)
    parser.add_argument('--preview-approved', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    collect(parser.parse_args())
