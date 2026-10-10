"""Synthetic PSP tiles only. No native assets or executable bytes."""
import importlib.util
from pathlib import Path
import struct
import unittest
import zlib

spec = importlib.util.spec_from_file_location('icons', Path(__file__).parents[1] / 'tools/mhp2g/native_item_icons.py')
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)


class ItemIconExtraction(unittest.TestCase):
    def test_crop_crosses_both_swizzle_tile_boundaries_and_preserves_alpha(self):
        palette = bytearray(1024)
        for index, color in enumerate([(255,0,0,255),(0,255,0,128),(0,0,255,0),(128,128,128,255)], 1):
            palette[index*4:index*4+4] = bytes(color)
        # Physical order is four 16x8 tiles; each tile uses one known palette index.
        picture = (32, 16, b'\x01'*128 + b'\x02'*128 + b'\x03'*128 + b'\x04'*128, palette)
        rgba = icons.crop_tinted(picture, (14,6,4,4), (100,200,50))
        expected = bytes([100,0,0,255])*2 + bytes([0,200,0,128])*2
        expected = expected*2 + (bytes([0,0,50,0])*2 + bytes([50,100,25,255])*2)*2
        self.assertEqual(rgba, expected)
        png = icons.encode_png(4,4,rgba)
        offset, data = 8, b''
        while offset < len(png):
            length = struct.unpack_from('>I', png, offset)[0]
            kind, value = png[offset+4:offset+8], png[offset+8:offset+8+length]
            self.assertEqual(zlib.crc32(kind+value)&0xffffffff,struct.unpack_from('>I',png,offset+8+length)[0])
            if kind == b'IDAT':data += value
            offset += 12+length
        self.assertEqual(zlib.decompress(data), b''.join(b'\0'+expected[y*16:(y+1)*16] for y in range(4)))
        with self.assertRaisesRegex(ValueError,'outside'):
            icons.crop_tinted(picture,(30,0,4,4),(255,255,255))
        with self.assertRaisesRegex(ValueError,'Empty'):
            icons.crop_tinted(picture,(0,8,4,4),(255,255,255))

    def test_rejects_unverified_pixel_format_and_changed_source(self):
        tmh = b'.TMH' + struct.pack('<III',1,1,0)
        tmh += struct.pack('<8I',32,0,1,1,16,1,4,32|(16<<16))
        with self.assertRaisesRegex(ValueError,'pixel format'):
            icons.tmh_pictures(tmh)
        with self.assertRaisesRegex(ValueError,'fingerprint'):
            icons.require_hash(b'changed',icons.digest(b'original'),'source')


if __name__ == '__main__':
    unittest.main()
