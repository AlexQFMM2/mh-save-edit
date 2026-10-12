"""Only synthetic symbolic paths; no extracted game data."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from mhp2g.quest_conditions import Conditions, atom, combine

class ConditionsTest(unittest.TestCase):
    def setUp(self):
        self.parser = object.__new__(Conditions)
        self.parser.call = lambda address, args: atom(address, questKey=f'test:{args[0]}' if args else 'test')

    def test_branch_result_zero_means_menu_visible(self):
        paths = [{'conditions': [], 'result': ['sltu', 0, ['xor', ['call', 'test', 1], 1]]}]
        self.assertEqual(self.parser.paths_for(paths, 0), atom('test', questKey='test:1'))

    def test_inherited_or_branch_retains_outer_gates(self):
        inherited = ['eq', ['call', 'inherited', 1], 1]
        gate = ['eq', ['call', 'introduction', 2], 1]
        paths = [{'conditions': [[gate, True], [inherited, True]], 'result': 1},
                 {'conditions': [[gate, True], [inherited, False]], 'result': ['call', 'current', 3]},
                 {'conditions': [[gate, False]], 'result': 0}]
        tree = self.parser.paths_for(paths, 1)
        self.assertEqual(tree['kind'], 'any')
        for branch in tree['children']:
            self.assertEqual(branch['children'][0]['text'], 'introduction')
        self.assertEqual(tree['children'][1]['children'][1]['kind'], 'not')

    def test_do_not_flatten_scoped_inheritance(self):
        scoped = {'kind': 'all', 'text': 'old save only', 'children': [atom('quest A'), atom('quest B')]}
        tree = combine('all', [scoped, atom('current gate')])
        self.assertEqual(tree['children'][0], scoped)

    def test_unknown_opcode_is_rejected(self):
        with self.assertRaises(ValueError):
            self.parser.expression(['unknown', 42])

if __name__ == '__main__':
    unittest.main()
