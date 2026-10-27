const { spawnSync } = require('node:child_process');
const command = `python3 - <<'PY'
from pathlib import Path
p = Path('/etc/letsencrypt/renewal/agent.no996ai.cn.conf')
s = p.read_text()
assert 'authenticator = webroot' in s
assert '[renewalparams]' in s
assert 'deploy_hook' not in s, 'Existing renewal hook requires review'
s = s.replace('[renewalparams]\\n', '[renewalparams]\\ndeploy_hook = nginx -t && systemctl reload nginx\\n', 1)
p.write_text(s)
print('AGENT_CERT_RENEWAL_RELOAD_HOOK_CONFIGURED')
PY
certbot certificates --cert-name agent.no996ai.cn`;
const result = spawnSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes',require('./local-config.cjs').deployHost(),command], { encoding:'utf8', timeout:20000, maxBuffer:65536, windowsHide:true });
console.log(result.stdout || '');
console.error(result.stderr || '');
console.log(`RENEWAL_CONFIG_EXIT=${result.status}`);
if (result.error || result.status !== 0) process.exitCode = 1;
