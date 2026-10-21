import { execFileSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const candidates = [process.env.YOUCHOP_PYTHON, process.env.PYTHON,
  join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Python', 'pythoncore-3.14-64', 'python.exe'),
  'python', 'py', 'python3',
  join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe')].filter(Boolean);
let python;
for (const candidate of candidates) {
  try { execFileSync(candidate, ['-c', 'import faster_whisper, yt_dlp'], { stdio: 'ignore', windowsHide: true, timeout: 15000 }); python = candidate; break; } catch {}
}
if (!python) {
  console.error('Install Python dependencies: python -m pip install -r tools/transcribe-requirements.txt\nThen set YOUCHOP_PYTHON to that Python executable if needed. FFmpeg is also needed for Instagram downloads.');
  process.exit(1);
}
const server = join(dirname(fileURLToPath(import.meta.url)), 'transcribe_server.py');
const child = spawn(python, [server, ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
child.on('error', e => { console.error(e.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
