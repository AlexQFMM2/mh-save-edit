"""Synthetic packaging tests; no native game data or fonts."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_package", ROOT / "tools/mhp2g/chinese-patch/package-release.py")
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class ReleasePackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.stage = self.root / "stage"
        plugin = self.stage / package.PLUGIN_ROOT
        plugin.mkdir(parents=True)
        data = {name: b"Synthetic test file\n" for name in package.RUNTIME_FILES}
        data["mhp2g_zh_cn.prx"] = b"\x7fELF\x01\x01" + b"Synthetic ELF stub"
        data["texts.bin"] = b"PZT2Synthetic text stub"
        data["plugin.ini"] = b"[options]\ntype = prx\nfilename = mhp2g_zh_cn.prx\nversion = 1\n[games]\nULJM05500 = true\n"
        self.manifest = {"schema": "p2g-pilot-build-v1", "probe": {"pilot": True, "mode": 1, "buildId": "known-text-v1-B-0123456789abcdef"},
                         "files": {name: {"bytes": len(raw), "sha256": package.digest(raw)} for name, raw in data.items()}}
        for name, raw in data.items():
            (plugin / name).write_bytes(raw)
        self.write_manifest()

    def write_manifest(self):
        (self.stage / "manifest.json").write_text(json.dumps(self.manifest))

    def build(self, name):
        return package.package_release(self.stage, self.root / name, "mhp2g-zh-v0.1.0-test.1")

    def test_repeatable_minimal_archive(self):
        a, b = self.build("first"), self.build("second")
        self.assertEqual(a["sha256"], b["sha256"])
        with zipfile.ZipFile(self.root / "first" / a["archive"]) as z:
            expected = {package.PLUGIN_ROOT + name for name in package.RUNTIME_FILES} | {"README.zh-CN.txt", "TESTING.zh-CN.txt", "SHA256SUMS.txt"}
            self.assertEqual(set(z.namelist()), expected)
            for line in z.read("SHA256SUMS.txt").decode().splitlines():
                sha, name = line.split("  ", 1)
                self.assertEqual(package.digest(z.read(name)), sha)
            readme = z.read("README.zh-CN.txt").decode("utf-8-sig")
            self.assertIn(a["buildId"], readme)
            self.assertNotIn("@VERSION@", readme)

    def test_refuses_tamper_or_extra_files_before_output(self):
        plugin = self.stage / package.PLUGIN_ROOT
        (plugin / "plugin.log").write_text("Synthetic private log")
        with self.assertRaisesRegex(ValueError, "Unexpected runtime"):
            self.build("extra")
        (plugin / "plugin.log").unlink()
        (plugin / "texts.bin").write_bytes(b"PZT2tampered")
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            self.build("tampered")
        self.assertFalse((self.root / "extra").exists())
        self.assertFalse((self.root / "tampered").exists())

    def test_coverage_comes_from_this_build(self):
        self.manifest["coverage"] = {"authoredUnits": 123, "untranslatedUnits": 0,
                                     "runtimeBindings": 14591, "pendingBindings": 6995}
        self.write_manifest()
        result = self.build("coverage")
        with zipfile.ZipFile(self.root / "coverage" / result['archive']) as z:
            readme = z.read('README.zh-CN.txt').decode('utf-8-sig')
            self.assertIn('14,591', readme)
            self.assertIn('6,995', readme)
            self.assertNotIn('@COVERAGE@', readme)
            self.assertNotIn('7,844', readme)

    def test_refuses_diagnostic_build_symlinks_and_path_keys(self):
        self.manifest["probe"]["mode"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "translated B"):
            self.build("diagnostic")
        self.manifest["probe"]["mode"] = 1
        self.manifest["files"]["../private.json"] = {"bytes": 1, "sha256": "0" * 64}
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "manifest file set"):
            self.build("path-key")
        self.manifest["files"].pop("../private.json")
        self.write_manifest()
        p = self.stage / package.PLUGIN_ROOT / "OFL.txt"
        content = p.read_bytes()
        p.unlink()
        target = self.root / "private-font-license.txt"
        target.write_bytes(content)
        p.symlink_to(target)
        with self.assertRaisesRegex(ValueError, "plain file"):
            self.build("linked")


if __name__ == "__main__":
    unittest.main()
