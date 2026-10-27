// 本机部署配置读取。仓库里不保存主机地址；真实值放 deploy/local.config.json（已忽略，不入库）或环境变量。
const fs = require('node:fs');
const path = require('node:path');

const configFile = path.join(__dirname, '..', 'deploy', 'local.config.json');

function readLocalConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch {
    return {};
  }
}

function deployHost() {
  const host = process.env.DEPLOY_HOST || readLocalConfig().host;
  if (!host) {
    throw new Error('缺少部署主机：请设置 DEPLOY_HOST，或在 deploy/local.config.json 写入 {"host":"root@..."}（该文件已忽略，不入库）。');
  }
  return host;
}

function deployServer() {
  return process.env.DEPLOY_SERVER || readLocalConfig().server || '';
}

module.exports = { readLocalConfig, deployHost, deployServer };
