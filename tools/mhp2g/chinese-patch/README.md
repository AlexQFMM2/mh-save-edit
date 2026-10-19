# P2G Pilot Tooling

Private inputs and outputs only. Do not commit translations, PGF files, native
evidence, generated profiles, PRX files or test kits. No tool here operates the
emulator. The user performs all game tests.

After the 2026-10-16 Windows resource-exhaustion incident, the two private generic
SSH helpers are disabled. Their timed-out queries continued on the host and
consumed excessive memory. Do not restore or reuse those helpers. Do not send
raw `Get-Content` strings, file objects or provider objects into deep
`ConvertTo-Json` serialization. Retrieve bounded plain logs separately, using
SCP when original bytes matter. A local SSH timeout does not bound the remote
process lifetime; complex queries require remote time/memory limits and an exit
check before retrying. Incident details and evidence locations are in the
[plan handoff](../../../plan/mhp2g-chinese-patch/README.md#2026-10-16-windows-故障排查与远程查询限制).

Read-only comprehensive resource analysis lives in
[`analysis/`](analysis/README.md). It maintains separate directory, text,
reference, image and unresolved-coverage evidence without modifying this pilot.

## Known-text trial

The subsequent 2026-10-16 user request explicitly authorizes a standalone public
test Release of this runtime plugin. `package-release.py <private-stage-B>
<new-private-output> --version mhp2g-zh-v0.1.0-test.2` verifies the six-file build
manifest and emits a deterministic ZIP with the standard memory-stick directory,
installation/testing instructions and checksums. The private source manifest,
research evidence, logs and local switch scripts are excluded. The Release is a
prerelease and does not claim completed translation or runtime acceptance. Run
`python3 -m unittest discover -s tests -p p2g_release_package_test.py -v` to check
packaging with synthetic data only. Installation and test templates live in
`docs/mhp2g-chinese-patch-install.md` and `docs/mhp2g-chinese-patch-testing.md`.

The 2026-10-16 user request authorizes an early trial of detected, translatable
text before complete resource/G1 acceptance. This does not pass either gate.
`collect-reviewed.mjs <private-config> <new-output.json>` imports the latest
source-bound catalog, weapon/armor names, quest and skill reviews, accepted
pilot text and manual reviews. Identity-specific names take precedence over
same-text reuse. Reviewed prose is reflowed into the original line slots without
dropping content or moving engine controls. Every decision retains its source
hash; unreviewed units explicitly retain Japanese. A private config names all
input files; the output records their hashes and separate review statuses.

The local NLLB experiment (`draft-translations.py`, optional dependencies in
`requirements-draft.txt`) was stopped after terminology and meaning failures.
Its private `segments.jsonl` is rejected diagnostic material, not a trial input.
No game text was uploaded. Model files and their license never ship in a kit.
`apply-batch-review.mjs` is an older draft-review merge helper; the trial uses
the reviewed-only collector instead.

`prepare-batch.mjs` separates reviewed/changed/untranslated units, preserved
literals, active runtime bindings and pending consumers/validation failures.
Filter tables 19–22 are excluded from ordinary UI translation. It rejects
machine drafts and unrecognized review statuses instead of silently shipping
them. Trial kits contain `coverage.json` with the remaining gaps.
Unknown controls fail closed; supported dynamic color, button and price tokens
must be preserved. This is still not proof of every consumer's display capacity.

`build-batch.mjs` takes the pinned toolchain, native snapshot, pilot evidence,
Noto TTC, text index, reviewed translations, resource analysis, scene instruction
and consumer evidence, accepted pilot B stage, a new private output directory,
quest-envelope analysis and quest-list analysis. It reuses
the pilot builder but emits the separate PZT2 format (32,768 entries / 4 MiB
maximum) and batch PRX. PZT1 retains its original 128-entry / 128 KiB limits.
The build sets the C row arrays to the actual record count. `build-memory.mjs`
checks the loaded ELF address span including BSS against an offline 8 MiB budget;
this does not establish available memory in a running game.
Binary lookup avoids a linear scan for each core query; bounded per-key logging
and aggregate counters keep large catalogs from flooding the log. A normal log
size cap stops batch logging without disabling healthy translations.

Core text uses the existing checked getter. The common resource lookup installs
scene, tutorial, training and quest getters only after their complete 16-word
instruction windows match; reloaded overlays are checked again. NPC message
replacement identifies one of the four
source resources by its complete directory header, then verifies the exact
source pointer, table, flag and bytes.

`quest-bindings.mjs` retains the physical member, record, offset and size of list
aliases even when the translation is shared with an envelope. In PZT2, a quest
row uses its record offset as table, six-field ordinal as index, and quest ID as
flag. `pilot_quest.c` verifies the source pointer, native record/slot chain, quest
ID and complete original string. Direct consumers return resident translations.
The twelve verified village copy calls still copy the original Japanese; only
their later getter can substitute a captured field after the destination bytes
are rechecked. Long translations never enter those original copy buffers.
Copied-source mismatch or stale capture leaves the native result unchanged.

For a full build:

```sh
node tools/mhp2g/chinese-patch/build-batch.mjs <pspdev> <native-dir> <pilot-evidence-dir> <NotoSansCJK-Regular.ttc> <text-index.json> <reviewed.json> <resources.json> <consumer-inspection.json> <accepted-pilot-stage-B> <new-output> <quest-envelopes.json> <quest-lists.json>
```

The test.2 build contains 21,586 changed physical bindings and 2,888 glyphs.
Known untranslated and pending bindings are zero. Unresolved title/image/program
sources and user-run display/stability acceptance remain separate gaps. See the
plan handoff for private build and validation locations. The 2026-10-19 user
request authorizes publishing this frozen runtime ZIP as a new standalone
prerelease and pushing the source, synthetic tests and documentation. Game tests
and installation remain the user's responsibility; no acceptance gate is passed
by publication.

Trial kits include the exact accepted pilot as stage P. Direct B installation
requires either this kit's reviewed A or the exact predecessor build and file
hashes declared in the kit. Stage P returns to the bundled pilot; restore returns
to the original pre-probe backup. Neither switching nor offline tests operate
the emulator. The user closes it and cold-starts the game.

Additional verification:

```sh
npx vitest run tests/mhp2gBatch.test.mjs tests/mhp2gQuestBindings.test.mjs
```

## Build

From the repository root, with the pinned PSPDev toolchain, Python Pillow and
fontTools installed:

```sh
node tools/mhp2g/chinese-patch/build-pilot.mjs <pspdev> <native-dir> <localization-dir> <review.json> <evidence-dir> <NotoSansCJK-Regular.ttc> <new-private-output>
```

The evidence directory contains `native-inspect.json`, `talk-code.json` and
`dialogue-bind.json`. The builder verifies frozen input hashes, original text,
identity bindings, UTF-8, control ordering and explicit line counts. The review
schema is `p2g-pilot-review-v1`; see `prepare-pilot.mjs`. Only the approved pilot
keys are supported. The TTC source SHA-256 and SC face index are pinned in
`build-font.py`; the OFL notice ships with the renamed P2G Project Sans font.

`texts.bin` is a little-endian `PZT1` packet with a 32-byte header, sorted 40-byte
entries, original and translated UTF-8 NUL-terminated strings, and a body CRC32.
Each entry includes its resource namespace, table, index, source offset and
resource bounds. The PRX also pins the exact text/font packet CRCs; installation
verifies SHA-256. Updating text requires rebuilding the matching PGF and PRX.
The 4096-byte authoring bound is a packet limit, not a promise that every game
consumer can display that length. The current pilot strings are at most 161
UTF-8 bytes; wider/longer future samples need separate consumer validation.

## Runtime Gate

Stage A leaves text and font selection original while testing the external font.
Stage B activates the verified subset only at the original font-info initialization
call, before the game populates its glyph cache. A missed initialization never
enables Chinese later. The 16-pixel build is provisional until user-run metrics
and visual testing confirm the original cache geometry and baseline.

The plugin retains the PGF, text, handles and a separate bounded 32 KiB font pool
for the process lifetime. Every glyph is checked using `sceFontGetCharInfo` and
an 8-bit scratch raster before activation. Both drawing and character metrics
dispatch through the same font-selection function. Other codepoints retain the
original font. Startup failures leave original selection and text unchanged;
late failures stop new translations and retain the already-selected font for
resident strings/cache consistency. Recover by cold restart, not hot unloading.

The message-setter hook preserves the five-argument PSP EABI and forwards all
pagination/animation parameters unchanged. NPC rows remain source-key candidates
until the complete trigger branch and actual page order are confirmed. Neither
successful logs nor offline tests imply G1 acceptance.

## Verify

```sh
npx vitest run tests/mhp2gPilot.test.mjs tests/mhp2gEquipmentProbe.test.mjs
python3 tests/p2g_pgf_test.py
node tools/mhp2g/chinese-patch/verify-ppsspp-pgf.mjs <private-PPSSPP-reference-dir> <font-build-dir>
node tools/mhp2g/chinese-patch/analyze-probe-log.mjs <plugin.log> <stage-manifest.json>
```

The optional official-parser check pins PPSSPP v1.15.4 source hashes, compiles
only its PGF parser/rasterizer with synthetic memory stubs, and checks every
mapped glyph and missing codepoint. It never starts PPSSPP. ASan/UBSan are
enabled; LeakSanitizer is disabled because the execution sandbox uses ptrace.

`verify-text-package.c` reads a complete real private packet through the
production parser and checks every binary lookup. Compile it with
`prx/pilot_core.c` and `prx/probe_core.c`, enabling `-DBATCH` for PZT2; compile
without that flag to check the original PZT1 pilot. Its output contains counts
only. Real packets and validation reports stay in the ignored private directory.

Windows switching reuses the original bone kit's backup, lock and log archive.
Only one plugin directory is active. Old bone A/B packet format and build entry
remain supported. See the generated Chinese instructions and the current
[handoff](../../../plan/mhp2g-chinese-patch/README.md).
