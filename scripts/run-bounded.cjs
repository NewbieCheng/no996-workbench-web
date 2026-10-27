const { spawn } = require('node:child_process');
const allowed = { install: ['install', '--fetch-timeout=15000', '--fetch-retries=0', '--no-audit', '--no-fund'], build: ['run', 'build'] };
const args = allowed[process.argv[2]];
if (!args) throw new Error('Use install or build');
const child = spawn(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', ...args] : args, { stdio: 'inherit', windowsHide: true });
const limit = setTimeout(() => { console.error('COMMAND_TIMEOUT=120000ms'); if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'inherit', windowsHide: true }); else child.kill('SIGTERM'); }, 120000);
child.on('exit', code => { clearTimeout(limit); console.log('COMMAND_COMPLETE=' + (code ?? 1)); process.exitCode = code ?? 1; });
child.on('error', error => { clearTimeout(limit); console.error(error); process.exitCode = 1; });
