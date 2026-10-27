import type { UserProfileFormData } from '../../../services/persona';

/**
 * 人设文档（User.md / Company.md）通用区块解析器 + 生成骨架。
 *
 * 兼容两种输出样式：
 * - AI 输出（对齐 user-profile-builder SKILL）：`## 个人基础信息` + `- 所属行业：值`
 * - 历史文档（旧本地模板产物）：`## 1. 个人与业务基础信息` + `- **所属行业**：值`
 *
 * 解析失败（区块或字段过少）由调用方回退为整篇 Markdown 原文渲染。
 */

export interface ProfileField {
  /** 字段标签，如「所属行业」（已去除 ** 加粗与首尾空白）。 */
  label: string;
  /** 字段值原样保留，不清洗内容。 */
  value: string;
}

export interface ProfileSection {
  /** 区块标题，已剥离 `1. ` 之类的序号。 */
  title: string;
  fields: ProfileField[];
}

export interface ParsedProfile {
  sections: ProfileSection[];
  /** `> 更新时间：…` blockquote 的日期部分；无则 undefined。 */
  updatedAt?: string;
}

/** 生成过程实时渲染用的静态骨架（对齐 SKILL 模板的三章节十二字段）。 */
export interface ProfileSkeletonSection {
  title: string;
  labels: string[];
}

export const USER_PROFILE_SKELETON: ProfileSkeletonSection[] = [
  { title: '个人基础信息', labels: ['所属行业', '职业身份', '核心产品/服务', '业务特色'] },
  { title: '目标用户画像', labels: ['年龄段', '客户单次消费水平', '地域', '职业特征'] },
  { title: '用户特征', labels: ['现状', '困扰', '需求', '障碍'] },
];

export const ACCOUNT_CARD_STREAM_SKELETON: ProfileSkeletonSection[] = [
  { title: '一、人物优势', labels: ['真实优势', '可放大的竞争力'] },
  { title: '二、目标人群与需求', labels: ['核心客户', '典型场景', '三大痛点', '当前替代方案及其不足', '购买动机'] },
  { title: '定位方案 A：专业权威型', labels: ['基础身份', '核心优势', '精准用户', '一句话专业定位'] },
  { title: '定位方案 B：垂直细分型', labels: ['基础身份', '核心优势', '精准用户', '一句话专业定位'] },
  { title: '定位方案 C：实战差异化型', labels: ['基础身份', '核心优势', '精准用户', '一句话专业定位'] },
  { title: '专业型', labels: ['账号昵称建议', '账号简介', '置顶内容主题'] },
  { title: '亲和型', labels: ['账号昵称建议', '账号简介', '置顶内容主题'] },
  { title: '差异化型', labels: ['账号昵称建议', '账号简介', '置顶内容主题'] },
  { title: '五、禁止事项与表达红线', labels: ['人设红线', '内容红线', '风格红线'] },
]

export const COMPANY_PROFILE_SKELETON: ProfileSkeletonSection[] = [
  { title: '企业与赛道定位', labels: ['企业名称', '行业赛道', '主营业务版图', '企业愿景与发展使命'] },
  { title: '目标市场与受众结构', labels: ['核心服务客群/市场'] },
  { title: '企业核心壁垒与竞争优势', labels: ['核心竞争壁垒'] },
];

export type ProfileKind = 'user' | 'company';

const PROFILE_LABEL_TO_FORM_KEY: Record<string, keyof UserProfileFormData> = {
  所属行业: 'industry',
  职业身份: 'role',
  '核心产品/服务': 'primaryBusiness',
  主要业务: 'primaryBusiness',
  目标客户: 'targetClients',
  客户困扰: 'clientPainPoints',
  困扰: 'clientPainPoints',
  '希望建立的形象': 'desiredImage',
  补充资料: 'additionalInfo',
};

export function formKeyForProfileLabel(label: string): keyof UserProfileFormData | null {
  const trimmed = label.trim();
  return PROFILE_LABEL_TO_FORM_KEY[trimmed] ?? null;
}

export function profileSkeleton(
  kind: ProfileKind,
  variant: 'legacy' | 'account-card' = 'account-card',
): ProfileSkeletonSection[] {
  if (kind === 'company') return COMPANY_PROFILE_SKELETON
  if (variant === 'legacy') return USER_PROFILE_SKELETON
  return ACCOUNT_CARD_STREAM_SKELETON
}

/** 解析结果是否足以支撑结构化查看态。 */
export function isParseUsable(parsed: ParsedProfile | null): boolean {
  if (!parsed) return false;
  const fieldCount = parsed.sections.reduce((sum, s) => sum + s.fields.length, 0);
  return parsed.sections.length >= 2 && fieldCount >= 4;
}

/** 剥离字段标签两侧的 ** 加粗。 */
function stripBold(text: string): string {
  return text.replace(/^\*\*(.+)\*\*$/, '$1').trim();
}

/** 跳过文档标题行（非区块）。 */
function isDocTitle(line: string): boolean {
  return /^user\s*profile$/i.test(line) || /^company\s*profile$/i.test(line);
}

/** 单行字段值写入 Markdown（保留原标签格式与文档尾部注释）。 */
export function updateProfileFieldMarkdown(
  markdown: string,
  sectionTitle: string,
  fieldLabel: string,
  nextValue: string,
): string {
  const sanitized = nextValue.replace(/\r?\n+/g, ' ').trim();
  const lines = markdown.split(/\r?\n/);
  let inSection = false;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const heading = /^#{2,3}\s+(.+)$/.exec(trimmed);
    if (heading) {
      const title = heading[1].replace(/^\d+[.、]\s*/, '').trim();
      inSection =
        title === sectionTitle ||
        title.includes(sectionTitle) ||
        sectionTitle.includes(title);
      continue;
    }
    if (!inSection) continue;

    const bullet = /^(\s*[-*]\s+)(.+?)[:：]\s*(.*)$/.exec(lines[i]);
    if (!bullet) continue;

    const label = stripBold(bullet[2].trim());
    if (label !== fieldLabel && !label.includes(fieldLabel) && !fieldLabel.includes(label)) {
      continue;
    }

    lines[i] = `${bullet[1]}${bullet[2]}：${sanitized}`;
    return lines.join('\n');
  }

  return markdown;
}

export function parseProfileMarkdown(markdown: string): ParsedProfile | null {
  const trimmed = markdown.trim();
  if (!trimmed) return null;

  const parsed: ParsedProfile = { sections: [] };
  let current: ProfileSection | null = null;

  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('```') || isDocTitle(line)) continue;

    const heading = /^#{2,3}\s+(.+)$/.exec(line);
    if (heading) {
      current = { title: heading[1].replace(/^\d+[.、]\s*/, '').trim(), fields: [] };
      parsed.sections.push(current);
      continue;
    }

    const quote = /^>\s*(.+)$/.exec(line);
    if (quote) {
      if (!parsed.updatedAt) {
        const match = /更新时间[:：]\s*(.+)$/.exec(quote[1]);
        if (match) parsed.updatedAt = match[1].trim();
      }
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet && current) {
      const kv = /^(.+?)[:：]\s*(.*)$/.exec(bullet[1]);
      if (kv) {
        current.fields.push({ label: stripBold(kv[1]), value: kv[2].trim() });
      }
      continue;
    }

    if (line.startsWith('---')) continue;

    const plainKv = /^(.+?)[:：]\s*(.*)$/.exec(line);
    if (plainKv && !/^[>*]/.test(line)) {
      if (!current) {
        current = { title: '内容', fields: [] };
        parsed.sections.push(current);
      }
      current.fields.push({ label: stripBold(plainKv[1]), value: plainKv[2].trim() });
      continue;
    }

    if (!/^[-*#>|]/.test(line) && !line.startsWith('---') && line.length <= 40) {
      current = { title: line.replace(/^\d+[.、]\s*/, '').trim(), fields: [] };
      parsed.sections.push(current);
    }
  }

  return parsed;
}

/** 反填映射：User.md 字段标签 → 表单字段。命中多个标签时取先出现者。 */
const USER_FIELD_LABEL_MAP: Record<string, string[]> = {
  industry: ['所属行业', '行业赛道'],
  role: ['职业身份', '企业名称'],
  primaryBusiness: ['核心产品/服务', '主要业务', '主营业务', '主营业务版图'],
  targetClients: ['目标客户', '核心目标客户', '我重点对接的客户群体', '核心服务客群/市场'],
  clientPainPoints: ['客户目前的状态和困扰', '客户痛点与核心困惑', '困扰'],
  desiredImage: ['希望建立的专业形象', '专业形象定位'],
};

/**
 * 从解析出的字段反填用户/企业表单；未命中的字段保留 fallback 原值。
 * 通用匹配：只要字段标签包含映射标签即视为命中（AI 可能加前后缀）。
 */
export function formFromParsed<T extends object>(
  parsed: ParsedProfile | null,
  fallback: T,
  keyLabelMap: Record<string, string[]> = USER_FIELD_LABEL_MAP,
): T {
  if (!parsed) return fallback;
  const patch: Record<string, string> = {};
  for (const section of parsed.sections) {
    for (const field of section.fields) {
      for (const [key, labels] of Object.entries(keyLabelMap)) {
        // 已由本次解析填过的 key、或 fallback 里已有值的 key 不再覆盖
        if (patch[key] !== undefined) continue;
        const current = (fallback as Record<string, unknown>)[key];
        if (typeof current === 'string' && current.trim()) continue;
        if (labels.some((label) => field.label.includes(label))) {
          patch[key] = field.value;
        }
      }
    }
  }
  return { ...fallback, ...patch };
}

/**
 * 流式生成期间的容错提取：取最后一个 ```fence 开标记之后、
 * 尚未闭合则取到文本末尾（供生成过程实时渲染骨架，不做结构校验）。
 */
export function extractStreamingFenced(text: string, fence: string): string {
  const marker = '```' + fence;
  const lowerText = text.toLowerCase();
  const lowerMarker = marker.toLowerCase();
  let start = -1;
  let searchFrom = 0;
  while (true) {
    const idx = lowerText.indexOf(lowerMarker, searchFrom);
    if (idx === -1) break;
    start = idx;
    searchFrom = idx + lowerMarker.length;
  }
  if (start === -1) return '';
  let body = text.slice(start + marker.length);
  if (body.startsWith('\r\n')) body = body.slice(2);
  else if (body.startsWith('\n')) body = body.slice(1);
  const closeIdx = body.lastIndexOf('```');
  if (closeIdx !== -1) body = body.slice(0, closeIdx);
  return body.trim();
}

/** 骨架填充渲染模型：每个骨架字段显示已流入的值或占位。 */
export interface SkeletonFieldView {
  label: string;
  value: string | null;
}

export interface SkeletonSectionView {
  title: string;
  fields: SkeletonFieldView[];
  /** AI 追加的、骨架之外的扩展字段（标签 + 值）。 */
  extras: ProfileField[];
}

/**
 * 用流式解析结果填充静态骨架：骨架字段按「解析标签包含骨架标签」匹配；
 * 解析出的骨架之外的字段作为扩展项追加到所属区块。
 */
export function fillSkeleton(
  kind: ProfileKind,
  parsed: ParsedProfile | null,
  variant: 'legacy' | 'account-card' = 'account-card',
): SkeletonSectionView[] {
  const skeleton = profileSkeleton(kind, variant);
  const views: SkeletonSectionView[] = skeleton.map((section) => ({
    title: section.title,
    fields: section.labels.map((label) => ({ label, value: null })),
    extras: [],
  }));

  if (!parsed) return views;

  for (const parsedSection of parsed.sections) {
    // 骨架区块按标题双向包含匹配（AI 可能加序号或后缀）
    const view =
      views.find((v) => v.title === parsedSection.title) ??
      views.find(
        (v) => v.title.includes(parsedSection.title) || parsedSection.title.includes(v.title),
      );
    for (const field of parsedSection.fields) {
      const target = view?.fields.find(
        (f) => f.value === null && (f.label === field.label || f.label.includes(field.label) || field.label.includes(f.label)),
      );
      if (target) {
        target.value = field.value;
      } else if (view) {
        view.extras.push(field);
      }
    }
  }
  return views;
}

/** 骨架已填充字段数（含扩展字段）。 */
export function filledSkeletonCount(views: SkeletonSectionView[]): number {
  return views.reduce(
    (sum, s) => sum + s.fields.filter((f) => f.value !== null).length + s.extras.length,
    0,
  );
}

/** 骨架字段总数。 */
export function skeletonFieldTotal(views: SkeletonSectionView[]): number {
  return views.reduce((sum, s) => sum + s.fields.length, 0);
}
