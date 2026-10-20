"""Preserva os resultados da instância descartável do SonarQube como JSON."""
import json
import os
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


def main() -> None:
    if not Path('.scannerwork/report-task.txt').is_file():
        print('Scanner não produziu report-task.txt; consulte os logs dos serviços.')
        return
    host = os.environ['SONAR_HOST_URL'].rstrip('/')
    if urlparse(host).hostname not in {'127.0.0.1', 'localhost'}:
        raise RuntimeError('Exportação permitida apenas para o SonarQube descartável do CI')
    project = next(line.partition('=')[2].strip() for line in Path('sonar-project.properties').read_text().splitlines()
                   if line.startswith('sonar.projectKey='))
    output = Path('sonar-reports')
    output.mkdir(exist_ok=True)
    queries = {
        'quality-gate': ('/api/qualitygates/project_status', {'projectKey': project}),
        'metrics': ('/api/measures/component', {'component': project, 'metricKeys': 'coverage,line_coverage,duplicated_lines_density,ncloc'}),
        # A resposta inclui o total de achados; esta exportação lista os primeiros 100.
        'issues': ('/api/issues/search', {'componentKeys': project, 'ps': 100}),
    }
    for name, (path, parameters) in queries.items():
        request = Request(host + path + '?' + urlencode(parameters),
                          headers={'Authorization': 'Bearer ' + os.environ['SONAR_TOKEN']})
        with urlopen(request, timeout=30) as response:
            data = json.load(response)
        (output / f'{name}.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print('Quality Gate, métricas e achados exportados para sonar-reports/.')


if __name__ == '__main__':
    main()
