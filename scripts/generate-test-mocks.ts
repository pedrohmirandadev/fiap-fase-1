import ts from 'typescript';
import { readdir, readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'tests/mocks/generated');
const header = '// Gerado por bun run mocks:generate. Não edite manualmente.\n';
const check = process.argv.includes('--check');
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) throw new Error('tsconfig.json não encontrado');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
  getCanonicalFileName: path => path, getCurrentDirectory: () => root, getNewLine: () => '\n'
}));
// Os arquivos gerados não precisam existir para que a primeira geração funcione.
const program = ts.createProgram([
  resolve(root, 'src/application/unit-of-work.ts'),
  resolve(root, 'src/application/work-order-queries.ts')
], parsed.options);
const checker = program.getTypeChecker();

function declaration(file: string, name: string): ts.InterfaceDeclaration {
  const source = program.getSourceFile(resolve(root, file));
  const found = source?.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === name);
  if (!found || !ts.isInterfaceDeclaration(found)) throw new Error(`Interface não encontrada: ${name}`);
  return found;
}

function methods(port: ts.InterfaceDeclaration): string[] {
  return checker.getPropertiesOfType(checker.getTypeAtLocation(port)).map(property => {
    const type = checker.getTypeOfSymbolAtLocation(property, port);
    const signatures = type.getCallSignatures();
    if (!signatures.length) throw new Error(`${port.name.text}.${property.name} não é um método`);
    for (const signature of signatures) {
      if (!checker.getPropertyOfType(checker.getReturnTypeOfSignature(signature), 'then')) {
        throw new Error(`${port.name.text}.${property.name} precisa retornar Promise`);
      }
    }
    return property.name;
  });
}

function modulePath(file: string): string {
  const path = relative(output, file).replaceAll('\\', '/').replace(/\.ts$/, '');
  return path.startsWith('.') ? path : `./${path}`;
}

const context = declaration('src/application/unit-of-work.ts', 'RepositoryContext');
const repositoryPorts = checker.getPropertiesOfType(checker.getTypeAtLocation(context)).map(property => {
  const symbol = checker.getTypeOfSymbolAtLocation(property, context).getSymbol();
  const port = symbol?.declarations?.find(ts.isInterfaceDeclaration);
  if (!port) throw new Error(`Porta de repositório não encontrada: ${property.name}`);
  return { key: property.name, port };
});
const ports = [...repositoryPorts.map(entry => entry.port), declaration('src/application/work-order-queries.ts', 'WorkOrderQueries')];
const files = new Map<string, string>();
let methodCount = 0;

for (const port of ports) {
  const name = port.name.text;
  const filename = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.mock.ts';
  const names = methods(port);
  methodCount += names.length;
  files.set(filename, header + `import type { ${name} } from '${modulePath(port.getSourceFile().fileName)}';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function create${name}Mock(scope: MockScope = createMockScope()): MockedPort<${name}> {
  return {
${names.map(method => `    ${method}: scope.method<${name}['${method}']>('${name}.${method}')`).join(',\n')}
  };
}
`);
}

const imports = repositoryPorts.map(({ port }) => {
  const name = port.name.text;
  const file = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `import { create${name}Mock } from './${file}.mock';`;
});
files.set('repository-mocks.ts', header + `import type { RepositoryContext } from '${modulePath(resolve(root, 'src/application/unit-of-work.ts'))}';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';
${imports.join('\n')}

export type RepositoryMocks = { [K in keyof RepositoryContext]: MockedPort<RepositoryContext[K]> };

export function createRepositoryMocks(scope: MockScope = createMockScope()): RepositoryMocks {
  return {
${repositoryPorts.map(({ key, port }) => `    ${key}: create${port.name.text}Mock(scope)`).join(',\n')}
  };
}
`);

files.set('index.ts', header + ports.map(port => {
  const name = port.name.text;
  const file = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `export { create${name}Mock } from './${file}.mock';`;
}).join('\n') + "\nexport { createRepositoryMocks, type RepositoryMocks } from './repository-mocks';\n");

const existing: string[] = await readdir(output).catch((error: NodeJS.ErrnoException): string[] => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
const stale: string[] = [];
if (!check) await mkdir(output, { recursive: true });
for (const [name, content] of files) {
  const file = resolve(output, name);
  const previous = existing.includes(name) ? await readFile(file, 'utf8') : undefined;
  if (previous === content) continue;
  stale.push(name);
  if (!check) {
    if (previous && !previous.startsWith(header)) throw new Error(`Arquivo não gerado encontrado: ${name}`);
    await writeFile(file, content);
  }
}
for (const name of existing.filter(name => name.endsWith('.ts') && !files.has(name))) {
  const file = resolve(output, basename(name));
  if (!(await readFile(file, 'utf8')).startsWith(header)) continue;
  stale.push(name);
  if (!check) await unlink(file);
}
if (check && stale.length) {
  console.error(`Mocks desatualizados: ${stale.join(', ')}. Execute bun run mocks:generate.`);
  process.exitCode = 1;
} else {
  console.log(`${check ? 'Mocks sincronizados' : 'Mocks gerados'}: ${ports.length} portas, ${methodCount} métodos.`);
}
