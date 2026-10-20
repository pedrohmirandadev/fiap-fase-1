import unittest
from check_coverage import read_coverage, validate


def record(name='src/example.ts', lines=100, hit=100, functions=100, called=100):
    return f'SF:{name}\nLF:{lines}\nLH:{hit}\nFNF:{functions}\nFNH:{called}\nend_of_record\n'


JUNIT = '<testsuites tests="1"><testsuite tests="1"><testcase name="example" /></testsuite></testsuites>'


class CoverageGateTest(unittest.TestCase):
    def test_accepts_full_execution_above_threshold(self):
        self.assertIn('1 testes executados', validate(record(), JUNIT))

    def test_allows_file_at_90_if_global_is_above_90(self):
        report = record(hit=90, called=90) + record(name='src/other.ts')
        self.assertIn('2 arquivos medidos', validate(report, JUNIT))

    def test_rejects_90_or_less_globally(self):
        for hit, called in [(90, 100), (100, 90), (89, 100), (100, 89)]:
            with self.subTest(hit=hit, called=called), self.assertRaises(ValueError):
                validate(record(hit=hit, called=called), JUNIT)

    def test_rejects_file_below_90_even_with_high_global_coverage(self):
        for hit, called in [(89, 100), (100, 89)]:
            with self.subTest(hit=hit, called=called), self.assertRaises(ValueError):
                validate(record(hit=hit, called=called) + record(name='src/large.ts', lines=1000, hit=1000), JUNIT)

    def test_rejects_missing_invalid_and_duplicated_lcov_records(self):
        for report in ['', 'SF:src/a.ts\nLF:1', record(hit=101), record(hit=-1), record(lines=0, hit=0), record() * 2, record().replace('LF:100', 'LF:100\nLF:100')]:
            with self.subTest(report=report), self.assertRaises(ValueError):
                read_coverage(report)

    def test_rejects_junit_with_skips_failures_or_errors(self):
        for tag in ['skipped', 'failure', 'error']:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                validate(record(), JUNIT.replace('name="example" />', f'name="example"><{tag}/></testcase>'))
        for attribute in ['skipped', 'failures', 'errors']:
            with self.subTest(attribute=attribute), self.assertRaises(ValueError):
                validate(record(), JUNIT.replace('tests="1"', f'tests="1" {attribute}="1"', 1))

    def test_rejects_empty_or_invalid_junit(self):
        for report in ['<testsuites />', '<other/>', '<testsuites><testcase>']:
            with self.subTest(report=report), self.assertRaises(Exception):
                validate(record(), report)

    def test_requires_measured_functions_and_valid_threshold(self):
        with self.assertRaises(ValueError):
            validate(record(functions=0, called=0), JUNIT)
        for threshold in [-1, 100]:
            with self.assertRaises(ValueError):
                validate(record(), JUNIT, threshold)


if __name__ == '__main__':
    unittest.main()
