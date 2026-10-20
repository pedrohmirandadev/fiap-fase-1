"""Inicializa apenas a instância SonarQube descartável do CI."""
import base64
from http.client import HTTPException
import json
import os
from pathlib import Path
import secrets
import time
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


def main() -> None:
    host = os.environ.get('SONAR_HOST_URL', 'http://127.0.0.1:9000').rstrip('/')
    if os.environ.get('SONAR_CI_BOOTSTRAP') != 'true' or urlparse(host).hostname not in {'127.0.0.1', 'localhost'}:
        raise RuntimeError('Bootstrap permitido apenas para a instância local e descartável do CI')
    environment = os.environ.get('GITHUB_ENV')
    if not environment:
        raise RuntimeError('GITHUB_ENV necessário para exportar o token ao scanner')

    def request(path, data=None, password=None):
        headers = {}
        if password is not None:
            credentials = base64.b64encode(f'admin:{password}'.encode()).decode()
            headers['Authorization'] = f'Basic {credentials}'
        body = None if data is None else urlencode(data).encode()
        response = urlopen(Request(host + path, data=body, headers=headers), timeout=15)
        with response:
            content = response.read()
        return json.loads(content) if content else {}

    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        try:
            if request('/api/system/status').get('status') == 'UP':
                break
        except (OSError, HTTPException, ValueError):
            pass
        time.sleep(5)
    else:
        raise RuntimeError('SonarQube não ficou disponível em 10 minutos')

    properties = {}
    for line in Path('sonar-project.properties').read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key, separator, value = line.partition('=')
            if separator:
                properties[key.strip()] = value.strip()
    project = properties['sonar.projectKey']
    password = secrets.token_urlsafe(36)
    request('/api/users/change_password', {'login': 'admin', 'previousPassword': 'admin', 'password': password}, password='admin')
    request('/api/projects/create', {'project': project, 'name': properties['sonar.projectName'], 'mainBranch': 'main'}, password=password)

    # Critérios globais também se aplicam à primeira análise, sem baseline de novo código.
    gate_name = 'Oficina CI - cobertura 90'
    request('/api/qualitygates/copy', {'sourceName': 'Sonar way', 'name': gate_name}, password=password)
    for metric, operator, threshold in [('line_coverage', 'LT', '90'), ('bugs', 'GT', '0'), ('vulnerabilities', 'GT', '0')]:
        request('/api/qualitygates/create_condition', {'gateName': gate_name, 'metric': metric, 'op': operator, 'error': threshold}, password=password)
    request('/api/qualitygates/select', {'gateName': gate_name, 'projectKey': project}, password=password)
    token = request('/api/user_tokens/generate', {'name': 'oficina-ci', 'type': 'PROJECT_ANALYSIS_TOKEN', 'projectKey': project}, password=password)['token']
    print(f'::add-mask::{token}')
    with open(environment, 'a') as output:
        output.write(f'SONAR_TOKEN={token}\n')
    print(f'SonarQube pronto: projeto {project}, Quality Gate {gate_name}.')


if __name__ == '__main__':
    main()
