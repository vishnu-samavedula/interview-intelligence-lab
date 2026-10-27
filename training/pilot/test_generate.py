import importlib.util
from pathlib import Path
import tempfile
import json
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('pilot_generation',Path(__file__).with_name('generate.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def annotation():return {'fields':[{'field_id':field,'value':None,'evidence':[]} for field in m.IDS]}

class IntegrityTests(unittest.TestCase):
    def test_field_array_preserves_contract_and_rejects_duplicates(self):
        payload=annotation();m.schema_check(payload,m.EXTRACTION);m.check_extraction(payload,[{'turn_id':1,'candidate':'I served in the Navy.'}])
        payload['fields'][-1]['field_id']=payload['fields'][0]['field_id']
        with self.assertRaisesRegex(ValueError,'exactly one'):m.check_extraction(payload,[])

    def test_only_visible_candidate_quotes_support_labels(self):
        payload=annotation();payload['fields'][0]={'field_id':'full_name','value':'Taylor Reed','evidence':[{'turn_id':2,'quote':'Taylor Reed'}]}
        visible=[{'turn_id':1,'interviewer':'Are you Taylor Reed?','candidate':'No, that is someone else.'}]
        with self.assertRaisesRegex(ValueError,'visible candidate'):m.check_extraction(payload,visible)
        payload['fields'][0]['evidence'][0]['turn_id']=1
        with self.assertRaisesRegex(ValueError,'visible candidate'):m.check_extraction(payload,visible)

    def test_question_labels_reject_history_repeats_and_invisible_premises(self):
        turns=[{'turn_id':3,'candidate':'I owned the scheduling change.'}]
        value={'decision':'ask','questions':['What changed?'],'category':'ask_clarify_claim','trigger_turn_id':3,'trigger_quote':'I owned the scheduling change.','information_need':'Clarify the effect'}
        m.schema_check(value,m.QUESTION);m.check_question(value,turns,[])
        with self.assertRaisesRegex(ValueError,'repeated'):m.check_question(value,turns,['What changed?'])
        value['trigger_turn_id']=2
        with self.assertRaisesRegex(ValueError,'visible window'):m.check_question(value,turns,[])

    def test_resuming_revalidates_cache_and_never_saves_authorization(self):
        client=m.Client('UNIT_TEST_NOT_A_REAL_SECRET')
        body=m.messages('instruction',{'visible':'data'})
        payload={'value':'ok'};schema=m.obj({'value':m.STRING})
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return json.dumps({'id':'unit-test-request','model':'unit-test-model','choices':[{'finish_reason':'stop','message':{'content':json.dumps(payload)}}]}).encode()
        with tempfile.TemporaryDirectory() as path:
            directory=Path(path)
            with patch.object(m.urllib.request,'urlopen',return_value=Response()) as call:
                self.assertEqual(client.call(directory,'unit','unit-test-model',body,schema),payload)
                self.assertEqual(client.call(directory,'unit','unit-test-model',body,schema),payload)
                self.assertEqual(call.call_count,1)
            for file in directory.glob('*.json'):self.assertNotIn(client.key,file.read_text())
            with self.assertRaisesRegex(RuntimeError,'changed'):client.call(directory,'unit','unit-test-model',m.messages('different',{}),schema)
            with self.assertRaisesRegex(ValueError,'revalidate'):
                client.call(directory,'unit','unit-test-model',body,schema,lambda value:(_ for _ in ()).throw(ValueError('revalidate')))

if __name__=='__main__':unittest.main()
