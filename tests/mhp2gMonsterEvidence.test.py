"""Synthetic cross-source disagreement and reordered-column fixtures."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('evidence', Path(__file__).parents[1] / 'tools/mhp2g/monster_evidence.py')
evidence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evidence)


class MonsterEvidence(unittest.TestCase):
    def test_ice_and_thunder_join_by_header_and_unknown_state_stays_unknown(self):
        rows = [['部位','斬撃','打撃','射撃','火','水','雷','氷','龍','気絶'],
                ['頭', '1','2','3','4','5','70','60','8','9']]
        table = dict(key='synthetic', heading_path=[dict(text='肉質')], expanded_cells=[
            dict(logical_row=i, logical_column=j, text=text) for i, row in enumerate(rows) for j, text in enumerate(row)])
        native = [dict(pointerOrdinal=0, zoneAddress=123, sha256='synthetic', rows=[[99,1,2,3,4,5,60,70,8,9]])]
        bound = evidence.bind_hitzones(native, [table])[0]
        self.assertEqual((bound['partNameCn'], bound['ice'], bound['thunder']), ('头部',60,70))
        self.assertEqual(bound['conditionCn'], '未标注状态 1')
        native[0]['rows'][0][6:8] = [70,60]
        self.assertEqual(evidence.bind_hitzones(native, [table])[0]['partNameCn'], '未标注部位 1')

    def test_reward_quantity_is_not_fabricated_and_partial_pool_rejected(self):
        self.assertEqual(evidence.reward_cell('素材(100%)'), (('素材',None,100.0),))
        self.assertEqual(evidence.reward_cell('素材×2(100%)'), (('素材',2,100.0),))
        self.assertIsNone(evidence.reward_cell('素材(50%)\n未解析的数据'))


if __name__ == '__main__':
    unittest.main()
