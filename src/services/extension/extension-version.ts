/**
 * 工作台要求的知源扩展最低版本。低于此版本应提示用户升级安装包。
 * 与插件 release-metadata.json / 下载包版本对齐。
 */
export const REQUIRED_EXTENSION_VERSION = '3.7.7';

/** 对外展示用的产品版本文案（未连上插件时的默认展示）。 */
export const EXTENSION_PRODUCT_VERSION_LABEL = `v${REQUIRED_EXTENSION_VERSION}`;

function parseSemverParts(version: string): number[] | null {
  const cleaned = version.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/** a < b 时返回 true（仅比 major.minor.patch 数字段）。 */
export function isExtensionVersionBelow(installed: string | undefined, required: string): boolean {
  if (!installed?.trim()) return true;
  const left = parseSemverParts(installed);
  const right = parseSemverParts(required);
  if (!left || !right) return true;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) return true;
    if (left[i] > right[i]) return false;
  }
  return false;
}

export function isExtensionOutdated(installedVersion: string | undefined): boolean {
  return isExtensionVersionBelow(installedVersion, REQUIRED_EXTENSION_VERSION);
}
