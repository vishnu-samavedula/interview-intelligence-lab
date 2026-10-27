"""Full-plan integrity: hold-out mechanisms, support and conditional generator balance."""
import collections,json,unittest
from pathlib import Path
HERE=Path(__file__).parent
class FullPlanTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.plan=json.loads((HERE/'plan.json').read_text());cls.rows=cls.plan['roots']
 def test_split_before_render_and_unique_entities(self):
  self.assertEqual(len(self.rows),750)
  for field in ['person','employer']:self.assertEqual(len({r['internal_entities'][field] for r in self.rows}),750)
  groups=collections.defaultdict(set);mechanisms=collections.defaultdict(set)
  for r in self.rows:
   groups[r['scenario_group_id']].add(r['split'])
   mechanisms[(r['role_family'],r['work_situation'],r['primary_risk'],tuple(r['question_intents']))].add(r['split'])
  self.assertTrue(all(len(v)==1 for v in groups.values()));self.assertTrue(all(len(v)==1 for v in mechanisms.values()))
 def test_training_coverage_and_cell_support(self):
  rows=[r for r in self.rows if r['split']=='train'];self.assertEqual(len(rows),500)
  fields=rows[0]['allowed_candidate_fields'].keys()|set(rows[0]['forbidden_fields'])
  for field in fields:
   count=sum(field in r['allowed_candidate_fields'] for r in rows)
   self.assertGreaterEqual(count,50);self.assertGreaterEqual(500-count,50)
  for model in {r['generator_model'] for r in rows}:
   members=[r for r in rows if r['generator_model']==model]
   for category in {c for r in rows for c in r['question_intents']}:self.assertGreaterEqual(sum(category in r['question_intents'] for r in members),25)
 def test_density_and_degree_year_consistency(self):
  for row in self.rows:
   fields=row['allowed_candidate_fields'];count=len(fields)
   self.assertTrue(count<=5 if row['density_intent']=='sparse' else 6<=count<=13 if row['density_intent']=='medium' else count>=14)
   for degree,year in [('bachelors_degree','bachelors_year'),('masters_degree','masters_year')]:self.assertEqual(degree in fields,year in fields)
   self.assertEqual(set(row['required_fact_clauses']),set(fields))
if __name__=='__main__':unittest.main()
