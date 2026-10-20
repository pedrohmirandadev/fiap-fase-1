import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs

from bootstrap_sonar import main


class SonarBootstrapTest(unittest.TestCase):
    def test_refuses_to_modify_an_instance_without_explicit_ci_flag(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(RuntimeError):
            main()

    def test_refuses_remote_server(self):
        with patch.dict(os.environ, {'SONAR_CI_BOOTSTRAP': 'true', 'SONAR_HOST_URL': 'https://sonar.example.test'}, clear=True), self.assertRaises(RuntimeError):
            main()

    def test_provisions_local_instance_and_exports_only_analysis_token(self):
        payloads = [{'status': 'UP'}, {}, {}, {}, {}, {}, {}, {}, {'token': 'temporary-analysis-token'}]
        responses = [ConnectionResetError('Servidor inicializando')] + [io.BytesIO(json.dumps(payload).encode()) for payload in payloads]
        with tempfile.TemporaryDirectory() as directory:
            environment = Path(directory) / 'github-env'
            with patch.dict(os.environ, {'SONAR_CI_BOOTSTRAP': 'true', 'GITHUB_ENV': str(environment)}, clear=True), \
                 patch('bootstrap_sonar.urlopen', side_effect=responses) as request, \
                 patch('bootstrap_sonar.time.sleep'), \
                 patch('bootstrap_sonar.secrets.token_urlsafe', return_value='temporary-admin-password'), \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                main()
            self.assertEqual(environment.read_text(), 'SONAR_TOKEN=temporary-analysis-token\n')
            self.assertNotIn('temporary-admin-password', output.getvalue())
            self.assertIn('::add-mask::temporary-analysis-token', output.getvalue())
            urls = [call.args[0].full_url for call in request.call_args_list]
            self.assertIn('http://127.0.0.1:9000/api/qualitygates/select', urls)
            conditions = [parse_qs(call.args[0].data.decode()) for call in request.call_args_list if call.args[0].full_url.endswith('/create_condition')]
            self.assertEqual({item['metric'][0] for item in conditions}, {'line_coverage', 'bugs', 'vulnerabilities'})
            condition = next(call.args[0] for call in request.call_args_list if call.args[0].full_url.endswith('/create_condition'))
            self.assertEqual(parse_qs(condition.data.decode()), {
                'gateName': ['Oficina CI - cobertura 90'], 'metric': ['line_coverage'], 'op': ['LT'], 'error': ['90']
            })


if __name__ == '__main__':
    unittest.main()
