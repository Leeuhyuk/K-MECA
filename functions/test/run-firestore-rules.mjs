import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const functionsRoot = path.resolve(here, '..');
const repoRoot = path.resolve(functionsRoot, '..');
const adoptiumRoot = 'C:\\Program Files\\Eclipse Adoptium';

function findJavaHome() {
  const configured = process.env.JAVA_HOME;
  if (configured && existsSync(path.join(configured, 'bin', 'java.exe'))) return configured;
  if (!existsSync(adoptiumRoot)) return configured || '';
  const candidates = readdirSync(adoptiumRoot)
    .filter(name => name.startsWith('jdk-21'))
    .sort()
    .reverse();
  return candidates.length ? path.join(adoptiumRoot, candidates[0]) : (configured || '');
}

const javaHome = findJavaHome();
if (!javaHome) {
  console.error('JDK 21 is required to run the Firestore emulator.');
  process.exit(1);
}

const configPath = path.join(repoRoot, 'firebase.json');
const testPath = path.join(functionsRoot, 'test', 'firestore.rules.test.mjs');
const testCommand = 'node --test "' + testPath + '"';
const firebaseCli = path.join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js'
);
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  Path: path.join(javaHome, 'bin') + ';' + (process.env.Path || '')
};

if (!existsSync(firebaseCli)) {
  console.error('Global firebase-tools installation was not found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [firebaseCli,
  'emulators:exec',
  '--only', 'firestore',
  '--project', 'demo-k-meca',
  '--config', configPath,
  testCommand
], {
  cwd: repoRoot,
  env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);