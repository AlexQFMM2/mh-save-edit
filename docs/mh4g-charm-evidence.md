# MH4G charm evidence and preparation

## Scope

MH4G checks distinguish encoding, reviewed appraisal constraints and exact controlled-input generation witnesses. A witness establishes production by the reviewed appraisal function under the independently tested inputs, not normal-play seed reachability, other acquisition routes or the live game's floating-point state. MH3G exact combinations and GU's separate rules are not replaced by this model.

## Private development evidence versus runtime data

Complete native research JSON, instruction windows, execution reports, recovery databases and acceptance reports stay local in the private research tree. Never commit them or include them in application resources. Authorized private distribution covers only the prepared runtime catalogs and previously approved assets.

The application now carries only **5264 distinct six-field outcomes** (class, slots, A skill/points, B skill/points), minimal rule parameters and integrity/version bindings. It does not carry execution cases, random states, floating-point traces, source-host paths or instruction addresses. Full independent-result/model agreement is checked by the producer, not at application startup.

The compact payload is committed by a reviewed hash in source code. That trust root does not come from the database, user settings or requests: editing records and recomputing a database checksum cannot admit new outcomes. A new reviewed outcome bank requires local independent verification and an explicit code/data update; never replace the commitment merely to make an unknown input pass.

## Reproducible local preparation

1. On the configured source host, run `tools/extract_mh4g_charm_native.py --code <existing-code.bin>` in memory. Capture `MH4G_NATIVE_JSON:` privately. The extractor requires the reviewed executable identity, does not overwrite the input, and rechecks its original hash.
2. When independently re-auditing, add `--instruction-windows` and capture the three fixed bounded windows privately. This is not an arbitrary binary-export option; the full executable remains on the host.
3. Independently execute the windows using the pinned development-only dependency:

   ```sh
   uv run --no-project --with unicorn==2.1.4 --python /usr/bin/python3 \
     python -B tools/audit_mh4g_charm_execution.py \
     --native <private-native.json> --windows <private-windows.json> \
     --cases-per-group 1024 --output <new-private-execution.json>
   ```

   This uses isolated ARM memory, specified FPSCR, controlled initial states, read-only code/data and instruction/write bounds. It is not a real-save or live-game experiment.
4. Stop writes to the target catalog, then prepare **each** runtime/canonical catalog with an explicit new private recovery file:

   ```sh
   node tools/prepare_mh4g_runtime_witnesses.mjs \
     --database <existing-runtime.sqlite> \
     --input <private-native.json> --execution <private-execution.json> \
     --backup <new-private-recovery.sqlite>
   ```

   The producer uses the existing Vite compiler for its shared TypeScript verification code, without introducing a runtime compiler dependency. It verifies all 6144 independent cases, including final states and float32 bits, before projecting a whitelist of runtime fields. It validates the reviewed compact commitment, takes a consistent SQLite backup, and installs rules/results transactionally. The old report table and metadata are deleted, with `secure_delete`, `VACUUM`, integrity checks and residual-byte checks. Backups still contain the old report and **must not be distributed**.
5. Run `pnpm data:audit:runtime`, the private-enabled regressions and the application build. Catalog reconstruction may invalidate the compact binding; reprepare and verify rather than overriding the guard.

`prepare_mh4g_charm_native.mjs --execution ...` remains a **local research/test** importer for full reports. Its output is not a distributable runtime catalog. Missing compact data stays unknown; migration does not invent proof.

## Ownership and packaging

- `mh4gCharmRules.ts`: float32 fulfillment, slots and class constraints.
- `mh4gCharmReplay.ts` / `projectMh4gWitnesses.ts`: local producer/test replay and independent-result comparison; not imported by the application's witness loader.
- `mh4gCharmWitnessData.mjs`: compact schema, native binding and code-owned reviewed commitment.
- `mh4gCharmRepository.ts` / `mh4gCharmWitnessRepository.ts`: rule/range consistency and compact result loading; no fallback to complete execution reports.
- `mh4gCharmWitnesses.ts` / `mh4gCharmValidation.ts`: exact outcome membership and field-specific feedback. Unwitnessed static combinations remain unknown, while encodable manual values remain editable.
- `searchMh4gCharms.ts`: only admitted outcomes, preserving actual A skills and explicitly bounded coverage. No range Cartesian product becomes confirmed.

The package audit rejects old report tables, retired metadata, non-runtime rule fields and stale/unreviewed compact data. Preparation and the pure-file post-package guard additionally reject report remnants in SQLite pages. Node-side schema audit must precede Electron native-dependency rebuilding; post-package identity checks do not load Node's SQLite addon.

Witnesses remain snapshot data, not new save fields. `dataVersion` covers preparation metadata, so old loadouts/history still undergo rehydration and validation.

## Verification

```sh
python3 -B tests/test_mh4g_charm_extractor.py
pnpm typecheck
pnpm data:audit:runtime
pnpm build
MH4G_CHARM_EXECUTION_FILE=<private-execution.json> pnpm test
```

The projection test expects `native-v1.json` beside the execution report unless `MH4G_CHARM_NATIVE_FILE` is explicitly supplied. `MH4G_RUNTIME_DATABASE` can select a read-only compact catalog for the real candidate test.

Public fixtures are synthetic. Tests needing private research inputs skip when those inputs are unavailable; this is not independent verification. A runtime catalog that exists but lacks compact witnesses fails the runtime candidate test rather than silently skipping. Local build/tests do not prove Windows UI, emulator reopen, true-hardware or exhaustive reachability acceptance.
