# P2G resource analysis

These tools read the pinned Japanese input through SSH. They do not attach to
PPSSPP, install a plugin, write host files, or copy an ISO, BOOT, DATA archive or
texture atlas to Linux. Real text, queries, indexes, previews and reports belong
in private research storage or ignored `.runtime-assets/` directories.

`collect.py` verifies the frozen native snapshot and cipher-reference hash. It
reads only literal data from the reference AST; it never imports or executes
that reference. The existing `native_item_icons.py` supplies the DATA decoder.
The reference is Seth VanHeulen's `mhef/psp.py`, GPL-3.0-or-later; it remains a
private input, and its lookup table is not embedded here.

Resolve the current registered host with `ssh_admin --list`. Use its verified
host-key alias when needed; do not disable host-key checks. From the repo root:

```sh
python3 -B tools/mhp2g/chinese-patch/analysis/collect.py \
  --host <registered-user@host> --root '<Windows-Japanese-root>' \
  --native <frozen-japanese-catalog-directory> \
  --reference <pinned-mhef-reference-file> \
  --mode inventory --output <new-private-directory>
```

Each run uses a new directory. It retains the exact submitted code/config in
`query.py`, source/input hashes and invocation in `run.json`, derived
`result.json`, and operational messages in `stderr.txt`. A failed run is not an
empty successful result. Early runs made before query retention was added have
hashes but no `query.py`; repeat runs provide the retained-source baseline.

Run modes serially:

- `inventory`: compare the complete ISO/expanded file set and stream hashes;
  verify the DATA directory and enumerate every top-level member. Prefix
  signatures remain candidates, not absence-of-text evidence.
- `texts --inventory <result>`: examine every member or explicit `--members`
  / half-open `--member-range START STOP`. Preserve native text/pagination
  indices, pointer slots, flags, exact UTF-8, hashes and control-token candidates.
  Unbound scans are capped and truncation is explicit. This does not establish
  complete Shift-JIS, UTF-16, dynamic-text or image coverage.
- `quests`: parse explicit quest members and verify inner payload digests. For
  quest lists, pass `--queries` containing `{"layout":"list"}`. Six text fields
  retain native pointers; gameplay scripts are outside this text parser.
- `resources`: index nested offset/length containers, overlay headers and TMH
  picture/palette metadata. No pixels are converted and no picture is classified
  as containing, or lacking, text. Unsupported formats remain unresolved.
- `inspect --queries <private-json>`: bounded static `metadata`, `range`,
  `calls`, `constants`, `pointers`, candidate `addresses`, encoded `strings`
  and binary `patterns`. Numeric hits and reconstructed addresses require
  register/control-flow review before becoming scene bindings.
- `preview`: only after explicit authorization, pass `--preview-approved` and
  the approved crop request. At most two small, hash-pinned crops are converted
  in host memory; full atlases are not exported. Crops alone do not prove which
  control uses a picture.

`audit.py` verifies run fingerprints, reconciles all top-level members, checks
the frozen core regression, string hashes and references, and shares quest text
only after native quest identity and all six fields agree. It emits a canonical
text index, coverage, image metadata and unresolved resources. Scene/caller
confirmation is separate; prior pilot acceptance is not reset.

```sh
python3 -B tools/mhp2g/chinese-patch/analysis/audit.py \
  --inventory <inventory-result> --texts <text-result> \
  --resources <resource-result> --quests <quest-envelope-result> \
  --quest-lists <quest-list-result> --native <frozen-texts.json> \
  --output <new-private-audit-directory>
python3 -B tests/p2g_analysis_test.py
```

Repeat collection against the same input and compare canonical text/bindings
and resource indexes. Run the audit into two new directories and compare every
output hash. A changed classifier can change candidate metadata without
changing text; report those separately. Tests use only synthetic corrupt and
valid inputs. Unknown formats, scene bindings or image text prevent complete
T-007 acceptance; directory coverage alone does not pass T-007 or G1.
