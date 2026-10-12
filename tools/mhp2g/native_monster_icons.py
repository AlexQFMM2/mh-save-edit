"""Read the Japanese P2G monster-list atlas on its source host.

The monster description getter (text table 17) identifies the actual monster
detail renderer, which reads the 14-byte list definitions and draws a 36px
rectangle from COCK_TMH picture 2. Variant icons reuse the unique list entry in
the game's size-record family. This does not merge their catalog identities.
Only cropped PNGs and structured provenance leave the source host.
"""
import base64
import struct
from pathlib import Path

LIST_VA, LIST_COUNT, LIST_STRIDE = 0x0892E2E0, 62, 14
FAMILY_VA, MONSTER_COUNT = 0x08998FF0, 90
MEMBER, PICTURE, ICON_SIZE = 5323, 2, 36


def resolve_icon_families(definitions, families):
    """Require an unambiguous, reciprocal native family; never match names."""
    by_id = {}
    for definition in definitions:
        identity = definition['monsterId']
        if identity in by_id:
            raise ValueError('Duplicate monster-list identity')
        by_id[identity] = definition
    groups = {}
    for family in families:
        identity, members = family['monsterId'], family['members']
        if identity in groups or identity not in members or len(set(members)) != len(members):
            raise ValueError('Invalid native family')
        groups[identity] = set(members)
    mappings, unrepresented = [], []
    for identity, members in groups.items():
        if any(groups.get(member) != members for member in members):
            raise ValueError('Nonreciprocal native family')
        candidates = members.intersection(by_id)
        if len(candidates) > 1:
            raise ValueError('Ambiguous monster-list family')
        if not candidates:
            unrepresented.append(identity)
            continue
        representative = next(iter(candidates))
        mappings.append(dict(monsterId=identity, iconMonsterId=representative,
                             kind='direct' if identity == representative else 'native-size-family'))
    if not set(by_id).issubset(groups):
        raise ValueError('Monster-list entry lacks native family')
    return mappings, unrepresented


def extract_monster_icons(game_root, substitution, toc, codec):
    root = Path(game_root) / 'PSP_GAME'
    boot = (root / 'SYSDIR/BOOT.BIN').read_bytes()
    codec.require_hash(boot, codec.BOOT_SHA256, 'BOOT')
    read = codec.elf_reader(boot)
    native_list = read(LIST_VA, LIST_COUNT * LIST_STRIDE)
    native_families = read(FAMILY_VA, MONSTER_COUNT * 4)
    definitions, families = [], []
    for ordinal in range(LIST_COUNT):
        row = native_list[ordinal * LIST_STRIDE:(ordinal + 1) * LIST_STRIDE]
        text_id, x, y, monster_id = row[:4]
        if text_id != ordinal or monster_id >= MONSTER_COUNT:
            raise ValueError('Unexpected monster-list definition')
        definitions.append(dict(monsterId=monster_id, descriptionIndex=text_id,
                                typeCode=row[12], crop=[x, y, ICON_SIZE, ICON_SIZE],
                                va=LIST_VA + ordinal * LIST_STRIDE, rowSha256=codec.digest(row)))
    for identity in range(MONSTER_COUNT):
        pointer = struct.unpack_from('<I', native_families, identity * 4)[0]
        window = read(pointer, 16)
        end = window.find(b'\xff')
        if end < 1 or any(value >= MONSTER_COUNT for value in window[:end]):
            raise ValueError('Invalid bounded family record')
        families.append(dict(monsterId=identity, pointer=pointer, members=list(window[:end]),
                             sha256=codec.digest(window[:end + 1])))
    mappings, unrepresented = resolve_icon_families(definitions, families)
    with (root / 'USRDIR/DATA.BIN').open('rb') as file:
        header = file.read(17 * 2048)
        codec.require_hash(header, codec.TOC_SHA256, 'DATA directory')
        directory = codec.decode_member(header, 0, substitution)
        if list(struct.unpack_from(f'<{len(toc)}I', directory)) != toc:
            raise ValueError('Resource directory differs from pinned index')
        start, end = toc[MEMBER:MEMBER + 2]
        if not 0 < end - start < 1024:
            raise ValueError('Unexpected monster icon resource size')
        file.seek(start * 2048)
        member = codec.decode_member(file.read((end - start) * 2048), start, substitution)
    codec.require_hash(member, codec.MEMBER_SHA256, 'COCK_TMH')
    picture = codec.tmh_pictures(member)[PICTURE]
    if picture[:2] != (256, 296):
        raise ValueError('Unexpected monster atlas dimensions')
    files = {}
    for definition in definitions:
        rgba = codec.crop_tinted(picture, definition['crop'], (255, 255, 255))
        png = codec.encode_png(ICON_SIZE, ICON_SIZE, rgba)
        sha = codec.digest(png)
        files[sha] = base64.b64encode(png).decode('ascii')
        definition.update(pngSha256=sha, path=f'catalog/icons/{sha}.png')
    return dict(schema='mhp2g-monster-icons-v1', gameId='mhp2g',
                source=dict(gameRoot=str(Path(game_root)), bootSha256=codec.digest(boot),
                            tocSha256=codec.TOC_SHA256, member=MEMBER,
                            memberSha256=codec.digest(member), picture=PICTURE,
                            listVa=LIST_VA, listSha256=codec.digest(native_list),
                            familyVa=FAMILY_VA, familySha256=codec.digest(native_families)),
                rendering=dict(descriptionGetterVa=0x08851594, detailRendererVa=0x0881A8F0,
                               iconRendererVa=0x08830078, resourceTag=11,
                               picture=PICTURE, cropSize=ICON_SIZE, inGameDisplaySize=51),
                definitions=definitions, families=families, monsters=mappings,
                unrepresented=unrepresented, files=files)
