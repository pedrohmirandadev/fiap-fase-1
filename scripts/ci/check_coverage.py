"""Valida cobertura LCOV e execução completa do JUnit, sem dependências externas."""
import argparse
import os
from pathlib import Path
import xml.etree.ElementTree as ET


def read_coverage(report: str) -> list[dict]:
    records = []
    for section in report.split('end_of_record'):
        values = {}
        for line in section.splitlines():
            key, separator, value = line.partition(':')
            if separator and key in {'SF', 'LF', 'LH', 'FNF', 'FNH'}:
                if key in values:
                    raise ValueError(f'Campo LCOV duplicado: {key}')
                values[key] = value
        if not values:
            continue
        if set(values) != {'SF', 'LF', 'LH', 'FNF', 'FNH'}:
            raise ValueError('Registro LCOV incompleto')
        record = {'file': values['SF']}
        for total, hit in [('LF', 'LH'), ('FNF', 'FNH')]:
            record[total], record[hit] = int(values[total]), int(values[hit])
            if not 0 <= record[hit] <= record[total]:
                raise ValueError(f'Contadores LCOV inválidos: {record["file"]}')
        if record['LF'] == 0:
            raise ValueError(f'Arquivo sem linhas medidas: {record["file"]}')
        records.append(record)
    if not records or len({r['file'] for r in records}) != len(records):
        raise ValueError('LCOV vazio ou com arquivos duplicados')
    return records


def validate(lcov: str, junit: str, minimum: float = 90) -> str:
    if not 0 <= minimum < 100:
        raise ValueError('Limiar deve estar entre 0 e 100, exclusivo em 100')
    root = ET.fromstring(junit)
    if root.tag not in {'testsuite', 'testsuites'}:
        raise ValueError('Raiz JUnit inválida')
    cases = list(root.iter('testcase'))
    if not cases:
        raise ValueError('JUnit sem casos de teste')
    for node in root.iter():
        if node.tag in {'skipped', 'failure', 'error'}:
            raise ValueError('JUnit contém teste pulado, falha ou erro')
        if node.tag in {'testsuite', 'testsuites'}:
            for attribute in ('skipped', 'failures', 'errors'):
                if int(node.get(attribute, '0')) != 0:
                    raise ValueError(f'JUnit contém {attribute}')
    records = read_coverage(lcov)
    totals = {key: sum(r[key] for r in records) for key in ('LF', 'LH', 'FNF', 'FNH')}
    if totals['FNF'] == 0:
        raise ValueError('LCOV sem funções medidas')
    for record in records:
        for total, hit, metric in [('LF', 'LH', 'linhas'), ('FNF', 'FNH', 'funções')]:
            if record[total] and record[hit] * 100 < minimum * record[total]:
                raise ValueError(f'{record["file"]}: {metric} abaixo de {minimum}%')
    for total, hit, metric in [('LF', 'LH', 'linhas'), ('FNF', 'FNH', 'funções')]:
        if totals[hit] * 100 <= minimum * totals[total]:
            raise ValueError(f'Cobertura global de {metric} deve ser maior que {minimum}%')
    return (f'## Testes e cobertura\n\n'
            f'- {len(cases)} testes executados; nenhuma falha ou teste pulado.\n'
            f'- {len(records)} arquivos medidos; mínimo de {minimum:g}% por arquivo.\n'
            f'- Linhas: {totals["LH"] / totals["LF"]:.2%}.\n'
            f'- Funções: {totals["FNH"] / totals["FNF"]:.2%}.\n'
            f'- Cobertura global estritamente maior que {minimum:g}%.\n')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lcov', default='coverage/lcov.info')
    parser.add_argument('--junit', default='coverage/junit.xml')
    arguments = parser.parse_args()
    summary = validate(Path(arguments.lcov).read_text(), Path(arguments.junit).read_text())
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write(summary)


if __name__ == '__main__':
    main()
