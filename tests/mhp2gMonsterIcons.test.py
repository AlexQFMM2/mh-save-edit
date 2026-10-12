"""Synthetic identities only; no game tables, images, or executable bytes."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('monster_icons', Path(__file__).parents[1] / 'tools/mhp2g/native_monster_icons.py')
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)


class MonsterIconIdentity(unittest.TestCase):
    def test_variants_keep_identity_and_reuse_only_explicit_family_icon(self):
        definitions = [dict(monsterId=7)]
        families = [dict(monsterId=i, members=[7, 13]) for i in [7, 13]]
        families.append(dict(monsterId=2, members=[2]))
        mappings, missing = icons.resolve_icon_families(definitions, families)
        self.assertEqual(mappings, [dict(monsterId=7, iconMonsterId=7, kind='direct'),
                                    dict(monsterId=13, iconMonsterId=7, kind='native-size-family')])
        self.assertEqual(missing, [2])

    def test_rejects_ambiguous_or_nonreciprocal_family(self):
        families = [dict(monsterId=i, members=[7, 13]) for i in [7, 13]]
        with self.assertRaisesRegex(ValueError, 'Ambiguous'):
            icons.resolve_icon_families([dict(monsterId=7), dict(monsterId=13)], families)
        families[1]['members'] = [13]
        with self.assertRaisesRegex(ValueError, 'Nonreciprocal'):
            icons.resolve_icon_families([dict(monsterId=7)], families)

    def test_rejects_duplicate_or_unrepresented_definition(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            icons.resolve_icon_families([dict(monsterId=7)] * 2, [])
        with self.assertRaisesRegex(ValueError, 'lacks native family'):
            icons.resolve_icon_families([dict(monsterId=7)], [])


if __name__ == '__main__':
    unittest.main()
