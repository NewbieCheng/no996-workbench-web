const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sshArgs = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes'];
const { deployHost, deployServer } = require('./local-config.cjs');
const host = deployHost();
const release = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const stage = `/srv/no996-workbench-web/staging/${release}`;

function run(name, command, args, limit = 20000) {
  console.log(`STEP_START=${name}`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: limit,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  const lines = ((result.stdout || '') + (result.stderr || '')).split(/\r?\n/);
  console.log(lines.slice(-80).join('\n'));
  console.log(`STEP_END=${name};EXIT=${result.status};TOTAL_LINES=${lines.length}`);
  if (result.error || result.status !== 0) throw result.error || new Error(`Failed: ${name}`);
}

try {
  if (!process.argv.includes('--skip-build')) {
    run('build', process.execPath, ['scripts/run-bounded.cjs', 'build'], 140000);
  }
  for (const file of ['deploy/update.sh', 'deploy/nginx-agent.conf']) {
    const target = path.join(root, file);
    fs.writeFileSync(target, Buffer.from(fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n')));
  }
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('Missing index.html');
  run('package', 'tar', ['-czf', 'deploy/artifact.tar.gz', '-C', 'dist', '.'], 120000);
  const checksum = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'deploy/artifact.tar.gz')))
    .digest('hex');
  fs.writeFileSync(path.join(root, 'deploy/artifact.sha256'), `${checksum}  artifact.tar.gz\n`);
  run('create-staging', 'ssh', [...sshArgs, host, `mkdir -p '${stage}'`]);
  run(
    'upload',
    'scp',
    [
      ...sshArgs,
      'deploy/artifact.tar.gz',
      'deploy/artifact.sha256',
      'deploy/update.sh',
      'deploy/nginx-agent.conf',
      `${host}:${stage}/`,
    ],
    600000,
  );
  run(
    'update',
    'ssh',
    [...sshArgs, host, `timeout --kill-after=10s 120s bash '${stage}/update.sh' '${release}'`],
    160000,
  );
  run(
    'reload-nginx',
    'ssh',
    [
      ...sshArgs,
      host,
      `set -euo pipefail; cp '${stage}/nginx-agent.conf' /etc/nginx/sites-available/agent.no996ai.cn; nginx -t; systemctl reload nginx; for i in 1 2 3 4 5; do curl --max-time 10 -fsS 'https://agent.no996ai.cn/api/v1/auth/captcha?type=click' -o /dev/null && break; sleep 1; done; curl --max-time 10 -fsS 'https://agent.no996ai.cn/api/v1/auth/captcha?type=click' -o /dev/null; echo NGINX_API_PROXY_OK`,
    ],
    60000,
  );
  fs.writeFileSync(
    path.join(root, 'deploy/latest-release.json'),
    JSON.stringify(
      {
        release,
        domain: 'agent.no996ai.cn',
        internalPort: 8897,
        server: deployServer(),
        checksum,
        mode: 'update',
        publishedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`RELEASE=${release}\nUPDATE_RUN_COMPLETE`);
} catch (error) {
  console.error(error.message);
  console.log('UPDATE_RUN_FAILED');
  process.exitCode = 1;
}
