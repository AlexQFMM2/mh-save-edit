"""Synthetic BLZ fixtures; no executable or game table data."""
import importlib.util
import pathlib
import struct
import unittest

spec = importlib.util.spec_from_file_location('mh4g_extractor', pathlib.Path(__file__).resolve().parents[1] / 'tools/extract_mh4g_charm_native.py')
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class BlzExtractionTests(unittest.TestCase):
    def fixture(self, pair=0xf000, extra=7):
        return struct.pack('<H', pair) + b'ABC\x10' + struct.pack('<II', 0x0800000e, extra)

    def test_decodes_backwards_without_changing_input(self):
        raw = self.fixture()
        before = bytes(raw)
        self.assertEqual(extractor.decompress_blz(raw), b'ABC' * 7)
        self.assertEqual(raw, before)

    def test_rejects_missing_or_invalid_footer(self):
        for value in [b'', b'abc', b'12345678']:
            with self.assertRaises(ValueError):
                extractor.decompress_blz(value)

    def test_caps_output_before_allocating(self):
        with self.assertRaisesRegex(ValueError, 'expanded length'):
            extractor.decompress_blz(self.fixture(extra=0xffffffff))

    def test_rejects_out_of_bounds_back_reference(self):
        with self.assertRaisesRegex(ValueError, 'back-reference out of bounds'):
            extractor.decompress_blz(self.fixture(pair=0xffff))

    def test_rejects_bad_endpoints(self):
        with self.assertRaises(ValueError):
            extractor.decompress_blz(self.fixture(extra=8))

    def test_unknown_executable_is_never_extracted(self):
        with self.assertRaisesRegex(ValueError, 'Unsupported MH4G'):
            extractor.extract(self.fixture(), 'synthetic')


if __name__ == '__main__':
    unittest.main()
