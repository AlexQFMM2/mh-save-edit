"""Package an explicitly authorized private B build for a standalone test Release.

Only six runtime files, installation/testing text and checksums enter the ZIP.
Native evidence and the input build manifest stay private. No network or host
operations are performed. Output must be a new directory outside the input.
"""

import argparse
import configparser
import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile


RUNTIME_FILES = {
    "OFL.txt", "THIRD_PARTY_PGF.txt", "mhp2g_zh_cn.prx",
    "plugin.ini", "texts.bin", "zh-cn.pgf",
}
PLUGIN_ROOT = "PSP/PLUGINS/mhp2g_zh_cn/"
DOC_ROOT = Path(__file__).resolve().parents[3] / "docs"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_plain(path):
    require(not path.is_symlink() and path.is_file(), f"Expected a plain file: {path.name}")
    return path.read_bytes()


def check_memory(data, memory_mb):
    # Same supported BOOT reservation as build-memory.mjs. Leave 1 MiB for
    # startup allocations; runtime logs are still required for acceptance.
    require(len(data) >= 52 and data.startswith(b"\x7fELF\x01\x01"), "Expected ELF32 little-endian PRX")
    at = struct.unpack_from("<I", data, 28)[0]
    stride, count = struct.unpack_from("<HH", data, 42)
    require(stride >= 32 and at + stride * count <= len(data), "Invalid ELF program headers")
    segments = []
    for i in range(count):
        kind, offset, address, _, file_bytes, memory_bytes, _, _ = struct.unpack_from("<8I", data, at + i * stride)
        if kind == 1:
            require(file_bytes <= memory_bytes and offset + file_bytes <= len(data), "Invalid loadable ELF segment")
            segments.append((address, address + memory_bytes))
    require(bool(segments), "No loadable ELF segments")
    resident = max(end for _, end in segments) - min(start for start, _ in segments)
    loader = (resident + 255) // 256 * 256
    available = 0x08000000 + memory_mb * 1024 * 1024 - 0x09D60400
    require(resident <= 8 * 1024 * 1024, "Module exceeds the offline resident-memory budget")
    require(loader + 1024 * 1024 <= available, "Insufficient declared plugin memory after the game reservation")


def package_release(stage, output, version):
    require(re.fullmatch(r"mhp2g-zh-v\d+\.\d+\.\d+-test\.\d+", version), "Expected a test release version")
    stage, output = Path(stage), Path(output)
    require(stage.is_dir() and not stage.is_symlink(), "Expected a plain stage directory")
    require(not output.exists() and not output.is_symlink(), "Output must not exist")
    require(not output.resolve().is_relative_to(stage.resolve()), "Output must be outside the input stage")
    manifest = json.loads(read_plain(stage / "manifest.json"))
    require(manifest.get("schema") == "p2g-pilot-build-v1", "Unknown build schema")
    probe = manifest.get("probe", {})
    require(probe.get("pilot") is True and probe.get("mode") == 1, "Only the translated B build can ship")
    build_id = probe.get("buildId", "")
    require(isinstance(build_id, str) and re.fullmatch(r"known-text-v\d+-B-[0-9a-f]{16}", build_id), "Unexpected build ID")
    require(set(manifest.get("files", {})) == RUNTIME_FILES, "Unexpected manifest file set")
    plugin = stage / PLUGIN_ROOT
    for ancestor in [stage / "PSP", stage / "PSP/PLUGINS", plugin]:
        require(ancestor.is_dir() and not ancestor.is_symlink(), "Linked or missing input directory")
    require({p.name for p in plugin.iterdir()} == RUNTIME_FILES, "Unexpected runtime directory contents")
    entries = {}
    for name in sorted(RUNTIME_FILES):
        data = read_plain(plugin / name)
        expected = manifest["files"][name]
        require(len(data) == expected.get("bytes") and digest(data) == expected.get("sha256"), f"Build hash mismatch: {name}")
        entries[PLUGIN_ROOT + name] = data
    ini = configparser.ConfigParser()
    ini.optionxform = str
    ini.read_string(entries[PLUGIN_ROOT + "plugin.ini"].decode("utf-8-sig"))
    require(dict(ini["games"]) == {"ULJM05500": "true"}, "Unexpected game scope")
    require(dict(ini["options"]) == {"type": "prx", "filename": "mhp2g_zh_cn.prx", "version": "1", "memory": "40"}, "Expected plugin configuration with memory = 40")
    check_memory(entries[PLUGIN_ROOT + "mhp2g_zh_cn.prx"], int(ini["options"]["memory"]))
    require(entries[PLUGIN_ROOT + "texts.bin"].startswith(b"PZT2"), "Expected batch text format")
    for target, source in [("README.zh-CN.txt", "mhp2g-chinese-patch-install.md"), ("TESTING.zh-CN.txt", "mhp2g-chinese-patch-testing.md")]:
        text = read_plain(DOC_ROOT / source).decode("utf-8")
        coverage = manifest.get("coverage")
        if coverage is not None:
            require(all(isinstance(coverage.get(k), int) and coverage[k] >= 0 for k in
                        ["authoredUnits", "untranslatedUnits", "runtimeBindings", "pendingBindings"]), "Invalid coverage counts")
            coverage_text = (f"已审阅 {coverage['authoredUnits']:,} 个文本单元，已检测范围未译 {coverage['untranslatedUnits']:,}。"
                             f"本包接入 {coverage['runtimeBindings']:,} 条引用；已译但待接入 {coverage['pendingBindings']:,} 条引用。")
            if coverage['pendingBindings']:
                coverage_text += "任务／教程／训练的待接入文字仍可能显示日文。"
            coverage_text += "来源尚未确认的标题／图片等文字仍可能为日文；新增内容的游戏内显示与稳定性待实测。"
        elif isinstance(manifest.get("keys"), list) and manifest['keys']:
            coverage_text = f"本包接入 {len(manifest['keys']):,} 条文本引用；其余覆盖范围见本版本发布说明。"
        else:
            coverage_text = "覆盖范围见本版本说明。"
        text = text.replace("@VERSION@", version).replace("@BUILD_ID@", build_id).replace("@COVERAGE@", coverage_text)
        entries[target] = b"\xef\xbb\xbf" + text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8")
    sums = "".join(f"{digest(data)}  {name}\n" for name, data in sorted(entries.items()))
    entries["SHA256SUMS.txt"] = sums.encode("utf-8")
    output.mkdir(parents=True)
    archive = output / f"{version}-ppsspp.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 16, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(archive) as z:
        require(z.testzip() is None and set(z.namelist()) == set(entries), "Archive verification failed")
        for name, data in entries.items():
            require(z.read(name) == data, f"Archive byte mismatch: {name}")
    archive_hash = digest(archive.read_bytes())
    (output / "SHA256SUMS.txt").write_text(f"{archive_hash}  {archive.name}\n", encoding="utf-8")
    return {"version": version, "buildId": build_id, "archive": archive.name,
            "sha256": archive_hash, "bytes": archive.stat().st_size, "files": len(entries)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", help="Private translated stage B with manifest.json")
    parser.add_argument("output", help="New private output directory")
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(package_release(args.stage, args.output, args.version), indent=2))
    except (ValueError, KeyError, OSError, configparser.Error) as error:
        parser.exit(1, f"Packaging refused: {error}\n")
