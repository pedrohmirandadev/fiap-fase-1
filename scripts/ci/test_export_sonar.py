import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from export_sonar import main


class SonarExportTest(unittest.TestCase):
    def test_does_not_request_results_if_analysis_was_not_published(self):
        with patch('export_sonar.Path.is_file', return_value=False), patch('export_sonar.urlopen') as request, contextlib.redirect_stdout(io.StringIO()):
            main()
        request.assert_not_called()

    def test_refuses_to_send_token_to_remote_host(self):
        with patch.dict(os.environ, {'SONAR_HOST_URL': 'https://remote.example.test'}, clear=True), patch('export_sonar.Path.is_file', return_value=True), self.assertRaises(RuntimeError):
            main()

    def test_exports_results_without_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            try:
                os.chdir(directory)
                Path('.scannerwork').mkdir()
                Path('.scannerwork/report-task.txt').write_text('projectKey=example\n')
                Path('sonar-project.properties').write_text('sonar.projectKey=example\n')
                payloads = [{'projectStatus': {'status': 'OK'}}, {'component': {}}, {'total': 0, 'issues': []}]
                responses = [io.BytesIO(json.dumps(payload).encode()) for payload in payloads]
                with patch.dict(os.environ, {'SONAR_HOST_URL': 'http://localhost:9000', 'SONAR_TOKEN': 'temporary-test-token'}, clear=True), patch('export_sonar.urlopen', side_effect=responses) as request, contextlib.redirect_stdout(io.StringIO()):
                    main()
                for filename, payload in zip(['quality-gate', 'metrics', 'issues'], payloads):
                    report = Path(f'sonar-reports/{filename}.json').read_text()
                    self.assertEqual(json.loads(report), payload)
                    self.assertNotIn('temporary-test-token', report)
                self.assertTrue(all(call.args[0].get_header('Authorization') == 'Bearer temporary-test-token' for call in request.call_args_list))
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
