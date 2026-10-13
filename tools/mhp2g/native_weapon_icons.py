"""Extract P2G weapon icon crops on the read-only source host.

Pass native_item_icons as codec. The weapon draw path resolves native model to
class, class to descriptor, and rarity to tint. Only cropped PNGs and explicit
catalog mappings leave the host; neither the executable nor atlas is emitted.
Catalog keys below are native table identities, not verified save IDs.
"""
import base64
import struct
from pathlib import Path

MODEL_CLASSES_VA, MODEL_COUNT = 0x08975984, 553
INDICES_VA, PALETTE_VA, RARITIES_VA = 0x089383C8, 0x08938414, 0x08938454
RECTS_VA, MEMBER = 0x089366F0, 5323


def extract_weapon_icons(game_root, substitution, codec):
    root = Path(game_root) / 'PSP_GAME'
    boot = (root / 'SYSDIR/BOOT.BIN').read_bytes()
    codec.require_hash(boot, codec.BOOT_SHA256, 'BOOT')
    read = codec.elf_reader(boot)
    classes = read(MODEL_CLASSES_VA, MODEL_COUNT)
    indices = read(INDICES_VA, 44)
    palette = read(PALETTE_VA, 64)
    rarity_colors = read(RARITIES_VA, 20)
    tables = []
    for address, data in [(MODEL_CLASSES_VA, classes), (INDICES_VA, indices),
                          (PALETTE_VA, palette), (RARITIES_VA, rarity_colors)]:
        tables.append(dict(va=address, size=len(data), sha256=codec.digest(data)))
    with (root / 'USRDIR/DATA.BIN').open('rb') as source:
        header = source.read(17 * 2048)
        codec.require_hash(header, codec.TOC_SHA256, 'DATA directory')
        directory = codec.decode_member(header, 0, substitution)
        start, end = struct.unpack_from('<2I', directory, MEMBER * 4)
        if not 0 < end - start < 1024:
            raise ValueError('Unexpected weapon icon resource size')
        source.seek(start * 2048)
        member = codec.decode_member(source.read((end - start) * 2048), start, substitution)
    codec.require_hash(member, codec.MEMBER_SHA256, 'DATA member 5323')
    pictures = codec.tmh_pictures(member)
    files, icons, weapons, excluded = {}, {}, [], []
    for family, address, count, stride in [('blademaster', 0x089574C8, 1150, 24),
                                            ('ranged', 0x0895E098, 354, 28)]:
        table = read(address, count * stride)
        tables.append(dict(va=address, size=len(table), sha256=codec.digest(table)))
        for index in range(count):
            row = table[index * stride:(index + 1) * stride]
            identity = f'weapon_{family}:{index}'
            if index == 0:
                excluded.append(dict(equipmentKey=identity, reason='native-placeholder',
                                     rowSha256=codec.digest(row)))
                continue
            model = struct.unpack_from('<H', row)[0]
            rarity = row[2]
            if model >= len(classes) or rarity >= 10 or classes[model] >= 11:
                raise ValueError(f'Unknown class/rarity for {identity}')
            weapon_class = classes[model]
            color = rarity_colors[rarity]
            if color >= 16:
                raise ValueError('Unknown weapon tint')
            key = f'{weapon_class}:{color}'
            if key not in icons:
                descriptor_id = struct.unpack_from('<H', indices, weapon_class * 2)[0]
                descriptor = read(RECTS_VA + descriptor_id * 12, 12)
                x, y, width, height, texture, resource = struct.unpack('<6H', descriptor)
                if resource != 11 or texture not in (0x8000, 0x8001) or (width, height) != (24, 24):
                    raise ValueError('Unexpected weapon icon descriptor')
                picture = texture & 0xFFF
                # 0x088314e8 passes palette bytes 2,1,0 to 0x0882c360,
                # which packs them into the vertex's R,G,B channels.
                tint = list(reversed(palette[color * 4:color * 4 + 3]))
                pixels = codec.crop_tinted(pictures[picture], (x, y, width, height), tint)
                png = codec.encode_png(width, height, pixels)
                sha = codec.digest(png)
                files[sha] = base64.b64encode(png).decode('ascii')
                icons[key] = dict(iconKey=key, classId=weapon_class, colorId=color,
                                  descriptorId=descriptor_id, descriptorVa=RECTS_VA + descriptor_id * 12,
                                  descriptorSha256=codec.digest(descriptor), picture=picture,
                                  crop=[x, y, width, height], tint=tint, pngSha256=sha,
                                  path=f'catalog/icons/{sha}.png')
            weapons.append(dict(equipmentKey=identity, modelId=model, classId=weapon_class,
                                rarityRaw=rarity, iconKey=key, rowSha256=codec.digest(row)))
    return dict(schema='mhp2g-weapon-icons-v1', gameId='mhp2g',
                source=dict(gameRoot=str(Path(game_root)), bootSha256=codec.BOOT_SHA256,
                            tocSha256=codec.TOC_SHA256, member=MEMBER,
                            memberSha256=codec.MEMBER_SHA256, tables=tables),
                rendering=dict(size=24, indexBank=0, dimmed=False,
                               textureFunction='RGBA modulate; RGB rounded to nearest byte; texture alpha preserved'),
                weapons=weapons, excluded=excluded, icons=list(icons.values()), files=files)
