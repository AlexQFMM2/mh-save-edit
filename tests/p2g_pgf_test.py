import importlib.util
from pathlib import Path
import random
import struct
import unittest

spec = importlib.util.spec_from_file_location('pgf_codec', Path(__file__).resolve().parents[1]/'tools/mhp2g/chinese-patch/pgf_codec.py')
pgf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pgf)


class PGFTests(unittest.TestCase):
    def glyphs(self):
        return {65: dict(width=3, height=2, left=0, top=2, advance=192, pixels=[0, 1, 15, 15, 1, 0]),
                1000: dict(width=2, height=2, left=-1, top=1, advance=128, pixels=[15]*4)}

    def test_sparse_mapping_and_metrics(self):
        glyphs = self.glyphs()
        data = pgf.encode_pgf(glyphs)
        self.assertEqual(pgf.decode_pgf(data), glyphs)
        self.assertEqual(data, pgf.encode_pgf(dict(reversed(list(glyphs.items())))))
        self.assertIn(b'P2G Project Sans', data)

    def test_nibble_rle(self):
        generator = random.Random(17)
        for n in range(1, 1024):
            for pixels in [[15]*n, [generator.randrange(16) for _ in range(n)]]:
                self.assertEqual(pgf.rle_decode(pgf.rle_encode(pixels), n), pixels)
        with self.assertRaises(ValueError):
            pgf.rle_encode([16])
        with self.assertRaises(ValueError):
            pgf.rle_decode(bytes([7]), 1)

    def test_rejects_truncation_tables_and_geometry(self):
        data = pgf.encode_pgf(self.glyphs())
        for n in range(len(data)):
            with self.assertRaises((ValueError, struct.error)):
                pgf.decode_pgf(data[:n])
        for offset in [4, 8, 12, 24, 28, 258, 364]:
            broken = bytearray(data)
            broken[offset] = 255
            with self.assertRaises(ValueError):
                pgf.decode_pgf(broken)
        glyphs = self.glyphs()
        glyphs[65]['width'] = 64
        with self.assertRaises(ValueError):
            pgf.encode_pgf(glyphs)


if __name__ == '__main__':
    unittest.main()
