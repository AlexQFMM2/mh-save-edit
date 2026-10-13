"""Build private codec parameters from frozen, audited local inputs (no execution of references)."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import re


def build(research):
    v1 = research / 'save-preflight-v1'
    reference = (v1 / 'references/mhef-psp.py').read_bytes()
    if hashlib.sha256(reference).hexdigest() != 'e961029e1f37c70879142a6c94cd76b32d36aa7ac9803517576a80be1cab7d69':
        raise ValueError('Frozen codec reference hash mismatch')
    constants = {}
    for cls in ast.parse(reference).body:
        if isinstance(cls, ast.ClassDef) and cls.name in ('SavedataCipher', 'PSPSavedataCipher'):
            constants[cls.name] = {n.targets[0].id: ast.literal_eval(n.value) for n in cls.body if isinstance(n, ast.Assign)}
    game, psp = constants['SavedataCipher'], constants['PSPSavedataCipher']
    native = json.loads((v1 / 'evidence/native-save-flow.json').read_text())
    if native['sha256'] != '3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846':
        raise ValueError('Native input is not the audited JP BOOT')
    encode, decode = bytes.fromhex(native['nativeEncodeHex']), bytes.fromhex(native['nativeDecodeHex'])
    if len(encode) != 256 or len(decode) != 256 or any(decode[v] != i for i, v in enumerate(encode)):
        raise ValueError('Native substitution tables are not inverse permutations')
    kirk = (v1 / 'references/kirk_engine.c').read_text()
    vault_text = kirk[kirk.index('keyvault'):]
    vault_text = vault_text[:vault_text.index('};')]
    vault = [bytes(int(n, 16) for n in re.findall(r'0x[0-9A-Fa-f]+', row)) for row in re.findall(r'\{([^{}]+)\}', vault_text)]
    vault = [row for row in vault if len(row) == 16]
    rank_table = []
    for file in ('currency-format-box-flags.json', 'rank-attachments-validation.json'):
        rows = json.loads((research / 'save-followup-v1' / file).read_text())['results']
        rank_table += next(x['values'] for x in rows if x['query']['mode'] == 'u16')
    result = dict(version=1, encode=encode.hex(), decode=decode.hex(), salt=game['_mhp2g_jp_hash_salt'].hex(),
                  multipliers=game['_key_default'], moduli=game['_key_modifier'], sfoKey=vault[3].hex())
    for key, attr in dict(gameKey='_mhp2g_jp_key', hashKey='_hash_key_5', macKey='_aes_key_10',
                          cipherMask1='_hash_key_6', cipherMask2='_hash_key_7', headerKey='_aes_key_12', streamKey='_aes_key_64').items():
        result[key] = psp[attr].hex()
    result['rankGates'] = [dict(bit=rank_table.index(qid), rank=rank) for qid, rank in
                           [(1104, 2), (1201, 3), (1218, 4), (2120, 5), (2201, 6), (3009, 7), (3103, 8), (3228, 9)]]
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--research', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = build(args.research)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print('Built private P2G save profile:', args.output)
