#!/usr/bin/env node
// Starts the API (in Docker), the web app and the extension together, in this
// terminal. Each line is prefixed with the part it comes from, and Ctrl+C
// stops all three.
//
//   pnpm dev            from the repository root
//   node scripts/dev.mjs   the same, without pnpm at the root
//
// It needs Node, pnpm and Docker, and runs on macOS, Linux and Windows.

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
// Docker Compose stops containers within 10 s; past this, children are killed.
const FORCE_STOP_AFTER_MS = 15_000;

const PARTS = [
  {
    name: 'api',
    color: 36,
    cwd: 'back',
    // Builds the image when the code changed, runs the migrations, then the
    // API. Only those two services' logs are shown, not the database's.
    command: 'docker',
    args: ['compose', 'up', '--build', '--attach', 'migrate', '--attach', 'api', '--no-log-prefix'],
  },
  { name: 'web', color: 35, cwd: 'front', command: 'pnpm', args: ['dev'] },
  { name: 'extension', color: 33, cwd: 'extension', command: 'pnpm', args: ['dev'] },
];

const paint = (color, text) => (useColor ? `\x1b[${color}m${text}\x1b[0m` : text);
const width = Math.max(...PARTS.map((part) => part.name.length));
const tag = (name, color) => paint(color, `[${name.padEnd(width)}]`);
const say = (message) => console.log(`${tag('dev', 1)} ${message}`);

function fail(message) {
  console.error(`${tag('dev', 31)} ${message}`);
  process.exit(1);
}

/** pnpm is a .cmd script on Windows, which Node only starts through a shell. */
function run(command, args, options) {
  return isWindows
    ? spawn([command, ...args].join(' '), { ...options, shell: true })
    : spawn(command, args, options);
}

function runSync(command, args, options) {
  return isWindows
    ? spawnSync([command, ...args].join(' '), { ...options, shell: true })
    : spawnSync(command, args, options);
}

const succeeds = (command, args) => runSync(command, args, { stdio: 'ignore' }).status === 0;

/** `KEY=value` lines, as Docker Compose reads an env file. */
function readEnvFile(path) {
  const settings = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) settings[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return settings;
}

function isLocalUrl(value) {
  try {
    const host = new URL(value).hostname;
    return ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(host);
  } catch {
    return false;
  }
}

// --- Before starting anything --------------------------------------------------

if (!succeeds('pnpm', ['--version'])) {
  fail('pnpm is not installed. Run `corepack enable pnpm`, or see https://pnpm.io/installation.');
}
if (!succeeds('docker', ['compose', 'version'])) {
  fail('Docker with Compose is not installed. See https://docs.docker.com/get-docker/.');
}
if (!succeeds('docker', ['info'])) {
  fail('Docker is not running. Start Docker Desktop (or the Docker service), then run this again.');
}

const apiEnv = join(root, 'back', '.env');
if (!existsSync(apiEnv)) {
  copyFileSync(join(root, 'back', '.env.example'), apiEnv);
  fail(
    'Created back/.env from back/.env.example. Set AI_API_KEY in it ' +
      '(guide: back/docs/AI-PROVIDER-SETUP.md), then run this again.',
  );
}

// The API refuses to start without a provider, and Docker would restart it in
// a loop. Catch the common case here; the API's own check stays the authority.
const apiSettings = readEnvFile(apiEnv);
if (!apiSettings.AI_BASE_URL) {
  fail('Set AI_BASE_URL and AI_API_KEY in back/.env (guide: back/docs/AI-PROVIDER-SETUP.md).');
}
if (!apiSettings.AI_API_KEY && !isLocalUrl(apiSettings.AI_BASE_URL)) {
  fail(
    `Set AI_API_KEY in back/.env: ${apiSettings.AI_BASE_URL} needs a key. ` +
      'Only a model server on this machine runs without one (guide: back/docs/AI-PROVIDER-SETUP.md).',
  );
}

const webEnv = join(root, 'front', '.env.local');
if (!existsSync(webEnv)) {
  copyFileSync(join(root, 'front', '.env.example'), webEnv);
  say('Created front/.env.local from front/.env.example. Its defaults work on this machine.');
}

for (const app of ['front', 'extension']) {
  if (existsSync(join(root, app, 'node_modules'))) continue;
  say(`Installing ${app} dependencies…`);
  const install = runSync('pnpm', ['install'], { cwd: join(root, app), stdio: 'inherit' });
  if (install.status !== 0) fail(`pnpm install failed in ${app}.`);
}

// --- Start the three parts -----------------------------------------------------

const env = { ...process.env };
if (useColor) env.FORCE_COLOR = '1';

const running = new Map();
let stopping = false;
let exitCode = 0;

function prefix(stream, target, label) {
  createInterface({ input: stream }).on('line', (line) => target.write(`${label} ${line}\n`));
}

for (const part of PARTS) {
  const label = tag(part.name, part.color);
  const child = run(part.command, part.args, {
    cwd: join(root, part.cwd),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group, so a stop reaches its whole tree exactly once.
    // On Windows, Ctrl+C already reaches every process on the console.
    detached: !isWindows,
  });
  running.set(part.name, child);
  prefix(child.stdout, process.stdout, label);
  prefix(child.stderr, process.stderr, label);

  child.on('error', (error) => {
    console.error(`${label} could not start: ${error.message}`);
  });
  // `close`, not `exit`: it fires once the last line of output is read.
  child.on('close', (code, signal) => {
    running.delete(part.name);
    if (!stopping) {
      console.error(`${label} stopped (${signal ?? `exit code ${code}`}). The others keep running.`);
      if (code) exitCode = code;
    }
    if (running.size === 0) finish();
  });
}

console.log('');
say(`API        http://localhost:3002/health  (the first Docker build takes a few minutes)`);
say(`Web app    http://localhost:3000  (use localhost, not 127.0.0.1)`);
say(`Extension  WXT opens a browser with the extension loaded`);
say(`Press Ctrl+C to stop all three.`);
console.log('');

// --- Stop ----------------------------------------------------------------------

function signalAll(signal) {
  for (const child of running.values()) {
    if (child.pid === undefined) continue;
    try {
      if (isWindows) {
        if (signal === 'SIGKILL') {
          spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        }
      } else {
        process.kill(-child.pid, signal);
      }
    } catch {
      // Already gone.
    }
  }
}

function stop() {
  if (stopping) {
    // A second Ctrl+C: don't wait.
    signalAll('SIGKILL');
    return;
  }
  stopping = true;
  console.log('');
  say('Stopping…');
  signalAll('SIGINT');
  setTimeout(() => signalAll('SIGKILL'), FORCE_STOP_AFTER_MS).unref();
}

function finish() {
  // The API containers restart on their own unless stopped. If Compose was
  // killed before it could stop them, stop them here.
  runSync('docker', ['compose', 'stop'], { cwd: join(root, 'back'), stdio: 'ignore' });
  if (stopping) say('Stopped.');
  process.exit(exitCode);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGHUP', stop);
process.on('exit', () => signalAll('SIGKILL'));
