#!/usr/bin/env python3
"""Prepare private, resumable machine drafts; never uploads source text.

Run with a local CTranslate2 NLLB model and sentencepiece. Project reviews take
precedence. A machine draft is never labelled reviewed or display accepted.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import time


TOKEN = re.compile(r'~[A-Za-z][0-9A-Za-z]*|%[-+ #0]*(?:\d+\$)?(?:\d+|\*)?'
                   r'(?:\.(?:\d+|\*))?(?:[hlL])?[a-zA-Z%]|'
                   r'\\[A-Za-z][^\s\\]*|[\x01-\x09\x0b-\x1f\x7f\ue000-\uf8ff]')
JAPANESE = re.compile(r'[\u3040-\u30ff\u3400-\u9fff]')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pieces(text):
    """Return alternating prose/control spans; LF stays with its prose."""
    result, at = [], 0
    for token in TOKEN.finditer(text):
        result.extend([(False, text[at:token.start()]), (True, token.group())])
        at = token.end()
    result.append((False, text[at:]))
    return result


def restore_lines(original, translated):
    """Preserve all native line slots without dropping translated characters."""
    lines = original.split('\n')
    if len(lines) == 1:
        return translated
    weights = [len(s) for s in lines]
    total = sum(weights)
    if not total:
        return original
    result, at, accumulated = [], 0, 0
    for weight in weights[:-1]:
        accumulated += weight
        end = round(len(translated) * accumulated / total)
        # Avoid splitting a Latin word, number or format literal where possible.
        while at < end < len(translated) and translated[end - 1].isascii() and translated[end].isascii() and translated[end - 1].isalnum() and translated[end].isalnum():
            end += 1
        result.append(translated[at:end])
        at = end
    result.append(translated[at:])
    return '\n'.join(result)


def compatible(original, translated):
    return (bool(translated) and '\0' not in translated and
            original.count('\n') == translated.count('\n') and
            [s for control, s in pieces(original) if control] ==
            [s for control, s in pieces(translated) if control])


def read_inputs(args):
    inputs = {}

    def read(file):
        file = Path(file)
        raw = file.read_bytes()
        inputs[str(file.resolve())] = digest(raw)
        return json.loads(raw)

    index = read(args.index)
    localization = read(args.localization)
    exact, core = {}, {}

    def add(original, chinese, basis, status, key=None):
        if chinese and compatible(original, chinese):
            decision = dict(original=original, translated=chinese, basis=basis,
                            status=status, sourceSha256=digest(original.encode()))
            # Native identities remain separate. Only the exact source string
            # is shared; a string match never assigns a resource or object ID.
            exact[original] = decision
            if key is not None:
                core[key] = decision

    for key, row in localization['units'].items():
        add(row['japanese'], row.get('chinese'), row.get('reviewBasis', 'Project localization'),
            'project-reviewed', key)
    for file in args.name_review:
        for row in read(file)['entries']:
            key = row['textKey']
            assert localization['units'][key]['japanese'] == row['japanese'], 'Stale name review'
            add(row['japanese'], row['chinese'], row['basis'], 'project-reviewed', key)
    for file in args.text_review:
        review = read(file)
        for row in review['units'].values():
            add(row['japanese'], row.get('chinese'), row.get('basis', 'Project text review'),
                'project-reviewed')
    pilot = read(args.pilot_review)
    for key, row in pilot['units'].items():
        add(row['original'], row['translated'], row['basis'], 'pilot-reviewed', key)
    for row in pilot['dialogue']:
        add(row['original'], row['translated'], row['basis'], 'pilot-reviewed')
    # Retain the latest identity-specific name where identical source names
    # have deliberately different translations in the catalog.
    glossary = {row['original']: row['translated'] for row in core.values()
                if len(row['original']) >= 3 and '\n' not in row['original'] and
                not TOKEN.search(row['original']) and JAPANESE.search(row['original'])}
    return index, core, exact, glossary, inputs


def run(args):
    import ctranslate2
    import sentencepiece

    index, core, exact, glossary, inputs = read_inputs(args)
    model_manifest = json.loads((args.model / 'source-manifest.json').read_text())
    for name, record in model_manifest['files'].items():
        assert digest((args.model / name).read_bytes()) == record['sha256'], 'Model hash mismatch'
    fingerprint = digest(json.dumps(dict(inputs=inputs, model=model_manifest,
                                         script=digest(Path(__file__).read_bytes())), sort_keys=True).encode())
    args.output.mkdir(parents=True, exist_ok=True)
    progress_file = args.output / 'segments.jsonl'
    state_file = args.output / 'run.json'
    state = dict(schema='p2g-local-draft-run-v1', fingerprint=fingerprint,
                 inputs=inputs, model=model_manifest, sourceUploaded=False,
                 ctranslate2=ctranslate2.__version__, sentencepiece=sentencepiece.__version__,
                 beamSize=args.beam, threads=args.threads)
    if state_file.exists():
        assert json.loads(state_file.read_text()) == state, 'Different run: use a new output directory'
    else:
        assert not progress_file.exists(), 'Orphan translation checkpoint'
        state_file.write_text(json.dumps(state, indent=2) + '\n')

    bindings_by_unit = collections.defaultdict(list)
    for key, binding in index['bindings'].items():
        bindings_by_unit[binding['unit']].append((key, binding))
    decisions, excluded, work = {}, {}, set()
    for key, unit in index['units'].items():
        original = unit['text']
        references = bindings_by_unit[key]
        if unit['source']['member'] == 15 and any(b.get('table', 0) >= 19 for _, b in references):
            excluded[key] = 'word-filter-or-unconfirmed-filter-table'
            continue
        if not original or not JAPANESE.search(TOKEN.sub('', original)):
            decisions[key] = dict(original=original, translated=original,
                                  status='literal-preserved', basis='Empty, symbol or non-Japanese literal')
            continue
        picked = None
        if unit['source']['member'] == 15:
            for _, binding in references:
                picked = core.get(f'{binding["table"]}:{binding["index"]}')
                if picked:
                    assert picked['original'] == original, 'Stale native key'
                    break
        picked = picked or exact.get(original)
        if picked:
            decisions[key] = dict(picked)
        else:
            for control, segment in pieces(original):
                if not control and JAPANESE.search(segment):
                    work.add(segment)

    translated = {}
    if progress_file.exists():
        for line in progress_file.read_text().splitlines():
            row = json.loads(line)
            assert row['original'] in work, 'Unexpected cached source'
            assert row['original'] not in translated, 'Duplicate cached source'
            translated[row['original']] = row
    pending = sorted(work - translated.keys(), key=lambda s: (len(s), s))
    print(json.dumps(dict(units=len(index['units']), reused=len(decisions), excluded=len(excluded),
                          segments=len(work), remaining=len(pending)), ensure_ascii=False), flush=True)
    if pending:
        tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(args.model / 'sentencepiece.bpe.model'))
        translator = ctranslate2.Translator(str(args.model), device='cpu', compute_type='int8',
                                           inter_threads=1, intra_threads=args.threads)
        # Replacing only exact reviewed terms before inference avoids inventing
        # a native ID and helps the model keep project terminology.
        terms = re.compile('|'.join(re.escape(s) for s in sorted(glossary, key=lambda s: (-len(s), s))))
        started = time.monotonic()
        with progress_file.open('a') as checkpoint:
            for at in range(0, len(pending), args.batch):
                batch = pending[at:at + args.batch]
                sources = [terms.sub(lambda m: glossary[m.group()], s.replace('\n', '')) for s in batch]
                tokens = [['jpn_Jpan'] + tokenizer.encode(s, out_type=str) + ['</s>'] for s in sources]
                # Do not let the engine silently truncate a long source.
                assert all(len(t) <= 512 for t in tokens), 'Segment exceeds model context'
                results = translator.translate_batch(tokens, target_prefix=[['zho_Hans'] for _ in batch],
                    beam_size=args.beam, max_decoding_length=512, max_input_length=0,
                    return_scores=True, repetition_penalty=1.05)
                for original, result in zip(batch, results):
                    hypothesis = result.hypotheses[0]
                    assert hypothesis[0] == 'zho_Hans', 'Wrong target language'
                    target = tokenizer.decode(hypothesis[1:]).strip()
                    assert target and len(hypothesis) < 512, 'Empty/truncated translation'
                    assert not TOKEN.search(target) and '\n' not in target, 'Model inserted engine controls or newline'
                    row = dict(original=original, translated=restore_lines(original, target), score=result.scores[0])
                    checkpoint.write(json.dumps(row, ensure_ascii=False) + '\n')
                    translated[original] = row
                checkpoint.flush()
                print(json.dumps(dict(done=min(at + len(batch), len(pending)), total=len(pending),
                                      elapsedSeconds=round(time.monotonic() - started))), flush=True)

    for key, unit in index['units'].items():
        if key in excluded:
            continue
        if key not in decisions:
            target = ''.join(s if control or not JAPANESE.search(s) else translated[s]['translated']
                             for control, s in pieces(unit['text']))
            assert compatible(unit['text'], target), 'Changed text control structure'
            decisions[key] = dict(original=unit['text'], translated=target, status='machine-draft',
                                  basis='Local NLLB-200 int8 Japanese to Simplified Chinese; not human reviewed')
        decisions[key].update(sourceSha256=unit['sha256'], sourceVersion=index['sourceVersion'])
    output = dict(schema='p2g-translations-v1', sourceVersion=index['sourceVersion'],
                  fingerprint=fingerprint, inputs=inputs, units=decisions, excluded=excluded,
                  counts=dict(collections.Counter(x['status'] for x in decisions.values())),
                  runtimeAccepted=False, displayAccepted=False)
    (args.output / 'translations.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(complete=True, counts=output['counts'], excluded=len(excluded))), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['index', 'localization', 'pilot-review', 'model', 'output']:
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--name-review', type=Path, action='append', default=[])
    parser.add_argument('--text-review', type=Path, action='append', default=[])
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--batch', type=int, default=32)
    parser.add_argument('--beam', type=int, default=2)
    run(parser.parse_args())
