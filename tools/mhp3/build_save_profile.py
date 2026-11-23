"""Build a private P3 savedata profile from audited inputs, without running reference code."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import re


def verified(path, expected):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f'Frozen input differs: {path.name}')
    return data


def build(research):
    references = research / 'mhp2g/save-preflight-v1/references'
    source = verified(references / 'mhef-psp.py',
                      'e961029e1f37c70879142a6c94cd76b32d36aa7ac9803517576a80be1cab7d69')
    constants = {
        cls.name: {node.targets[0].id: ast.literal_eval(node.value)
                   for node in cls.body if isinstance(node, ast.Assign)}
        for cls in ast.parse(source).body if isinstance(cls, ast.ClassDef)
        and cls.name in ('SavedataCipher', 'PSPSavedataCipher')
    }
    game, psp = constants['SavedataCipher'], constants['PSPSavedataCipher']
    encode, decode = game['_encode_table'], game['_decode_table']
    if len(encode) != 256 or len(decode) != 256 or bytes(range(256)).translate(encode).translate(decode) != bytes(range(256)):
        raise ValueError('Substitution tables are not inverse permutations')
    kirk = verified(references / 'kirk_engine.c',
                    '74e363f78fdec5c0fc82842a21c11c3b0363996a931805cec9fd11231a3e7763').decode()
    vault = kirk.split('keyvault', 1)[1].split('};', 1)[0]
    keys = [re.findall(r'0x[0-9a-fA-F]+', row) for row in re.findall(r'\{([^{}]+)\}', vault)]
    sfo = [bytes(int(value, 16) for value in row) for row in keys if len(row) == 16][3]

    native = json.loads(verified(research / 'mhp3/armor-catalog-20261026/native-armors.json',
                                 'a86cbaa808bc8e4063423e38a849f163ec1368c89a28bb2fe1faac3e72911a40'))
    # Native 0x0885e12c reads the four upgrade boundaries in each armor row.
    caps = {}
    for table in native['armors']:
        for row in table['records']:
            if row['nativeId'] == 0:
                continue
            raw = bytes.fromhex(row['rawHex'])
            key = f"mhp3:armor:{table['type']}:{row['nativeId']}"
            if len(raw) != 40 or key in caps:
                raise ValueError('Invalid native armor identity')
            caps[key] = max(0, min(63, max(raw[21:25]) - 1))
    if len(caps) != 1131:
        raise ValueError('Incomplete native armor caps')
    result = dict(version=1, gameId='mhp3', encode=encode.hex(), decode=decode.hex(),
                  salt=game['_mhp3_jp_hash_salt'].hex(), multipliers=game['_key_default'],
                  moduli=game['_key_modifier'], sfoKey=sfo.hex(), armorCaps=caps)
    for key, attribute in dict(gameKey='_mhp3_jp_key', hashKey='_hash_key_5', macKey='_aes_key_10',
                               cipherMask1='_hash_key_6', cipherMask2='_hash_key_7',
                               headerKey='_aes_key_12', streamKey='_aes_key_64').items():
        result[key] = psp[attribute].hex()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--research', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = build(args.research)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
