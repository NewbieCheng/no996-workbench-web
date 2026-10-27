import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Code2,
  Inbox,
  Layers,
  Moon,
  Pencil,
  Search,
  SparklesIcon,
  Sun,
  Trash2,
  Copy,
} from 'lucide-react';
import { Button } from '@no996/ui/button';
import { Badge } from '@no996/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@no996/ui/alert';
import { ActionBar } from '@no996/ui/ActionBar';
import { DataTable, type DataColumn } from '@no996/ui/data-table';
import { ConfirmDialog, FormDialog } from '@no996/ui/FormDialog';
import { SearchPickerDialog } from '@no996/ui/search-picker-dialog';
import {
  ActivityTimeline,
  Progress,
  ResultState,
  WizardSteps,
  type WizardStepsVariant,
} from '@no996/ui/feedback';
import { StatusBadge } from '@no996/ui/StatusBadge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@no996/ui/empty';
import { IconActionButton } from '@no996/ui/IconActionButton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@no996/ui/dialog';
import {
  GlassMenu,
  GlassMenuItem,
  GlassMenuSeparator,
  GlassMenuDropdown,
  GlassMenuDropdownContent,
  GlassMenuDropdownItem,
  GlassMenuDropdownTrigger,
  GlassMenuFooter,
  GlassMenuGroupLabel,
} from '@no996/ui/glass-menu';
import {
  AttachmentUploader,
  createAttachmentDrafts,
  releaseAttachmentDrafts,
  type AttachmentUploaderItem,
} from '@no996/ui/attachment-uploader';
import {
  ChipToggleGroup,
  FloatingInput,
  FloatingSelect,
  FloatingTextarea,
  FormField,
  FormRow,
  FormSearchField,
  FormSection,
  FormSectionBody,
  FormSheet,
} from '@no996/ui/module-form';
import { ImagePreviewThumb, PreviewableImage } from '@no996/ui/image-preview';
import { ModuleRecordList } from '@no996/ui/module-record-list';
import {
  AISkeletonResult,
  AITaskButton,
  AITaskProgress,
  AIThinkingBubble,
  GlassBadge,
  GlassButton,
  GlassPanel,
  MediaGenerationStage,
  type MediaGenerationKind,
  type MediaGenerationStagePhase,
  WorkflowCanvas,
  FlowExplain,
} from '@no996/ui';
import { Page } from '../../components/WorkbenchUI';
import { clearComponentCatalogAccess } from '../../app/private-component-catalog-access';
import { WorkflowRunCard } from '../../components/agent/WorkflowRunCard';
import type { AgentRunSnapshot } from '../../agent';
import { TITLES_STAGES } from '../titles/agent/stages';
import { ComposerStandardsDemo } from './ComposerStandardsDemo';
import { ComposerContextStripStandardsDemo } from './ComposerContextStripStandardsDemo';
import { StructuredDocumentStandardsDemo } from './StructuredDocumentStandardsDemo';
import { DocumentExportStandardsDemo } from './DocumentExportStandardsDemo';
import { AIEditPopoverStandardsDemo } from './AIEditPopoverStandardsDemo';
import './component-catalog.css';

interface DemoRow {
  id: string;
  name: string;
  platform: string;
  points: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: '1', name: '告别加班的开屏文案', platform: '小红书', points: 12 },
  { id: '2', name: '热点借势：秋招季', platform: '抖音', points: 35 },
  { id: '3', name: '朋友圈周排期素材', platform: '朋友圈', points: 8 },
];

const GLASS_MENU_REFERENCE_ITEMS: Array<{ icon: string; label: string }> = [
  { icon: '🤖', label: 'AI 剧本生成 (默认)' },
  { icon: '📝', label: '爆款标题分析' },
  { icon: '📊', label: '产品报告导出' },
  { icon: '🌐', label: '全网热点借势' },
  { icon: '🎬', label: '短视频分镜剪辑' },
  { icon: '💡', label: '选题灵感库' },
  { icon: '⚙️', label: '工作流参数配置' },
];

const BUTTON_SNIPPET = `import { Button, GlassButton, GlassPanel, GlassBadge, Tabs, TabsList, TabsTrigger } from '@no996/ui';

// 工作台工具栏、视图切换、生成操作：不依赖业务页面 CSS
<Button variant="toolbar">新建人设</Button>
<Button variant="generate" size="action" disabled={pending} aria-busy={pending}>开始生成</Button>
<Tabs value={view} onValueChange={setView}>
  <TabsList variant="toolbar" aria-label="页面视图">
    <TabsTrigger value="work">创作</TabsTrigger>
    <TabsTrigger value="history">记录</TabsTrigger>
  </TabsList>
</Tabs>

// 1. 全局标准按钮 (已穿透 Liquid Glass 体系)
<Button>新建产品</Button>
<Button variant="secondary">次要操作</Button>
<Button variant="outline">查看详情</Button>
<Button variant="ghost">取消</Button>
<Button variant="destructive">删除</Button>

// 2. 交互高阶 GlassButton (3D 俯仰 + 动态光晕)
<GlassButton size="sm">小尺寸</GlassButton>
<GlassButton size="default">标准尺寸</GlassButton>
<GlassButton size="lg" loading={loading}>加载中</GlassButton>
<GlassButton size="icon" aria-label="闪电"><SparklesIcon className="size-4" /></GlassButton>

// 3. 毛玻璃面板与徽章
<GlassPanel className="p-5">
  <div className="panel-body">
    <div className="panel-icon"><SparklesIcon className="size-5" /></div>
    <h3>Liquid Glass 面板</h3>
    <p>1px 渐变描边 + 内阴影高光 + 跟随鼠标流动微光</p>
    <div className="panel-footer">
      <GlassButton size="sm">Explore</GlassButton>
      <GlassBadge>Stable</GlassBadge>
    </div>
  </div>
</GlassPanel>`;

const GLASS_MENU_SNIPPET = `import {
  GlassMenuDropdown,
  GlassMenuDropdownContent,
  GlassMenuDropdownItem,
  GlassMenuDropdownTrigger,
  GlassMenuFooter,
  GlassMenuGroupLabel,
  GlassMenuSeparator,
} from '@no996/ui/glass-menu';

<GlassMenuDropdown>
  <GlassMenuDropdownTrigger render={<Button variant="outline">打开菜单</Button>} />
  <GlassMenuDropdownContent align="end" className="w-56">
    <GlassMenuGroupLabel>分组标题</GlassMenuGroupLabel>
    <GlassMenuDropdownItem>菜单项</GlassMenuDropdownItem>
    <GlassMenuSeparator />
    <GlassMenuFooter>
      <GlassMenuDropdownItem>底部操作</GlassMenuDropdownItem>
    </GlassMenuFooter>
  </GlassMenuDropdownContent>
</GlassMenuDropdown>`;

const ATTACHMENT_UPLOADER_SNIPPET = `import { AttachmentUploader, createAttachmentDrafts } from '@no996/ui/attachment-uploader';

<AttachmentUploader
  kind="image"
  maxCount={3}
  items={items}
  onAdd={(files) => setItems((prev) => [...prev, ...createAttachmentDrafts(files)])}
  onRemove={(id) => setItems((prev) => prev.filter((item) => item.id !== id))}
  emptyTitle="拖拽文件到这里，或点击上传"
/>`;

const COMPOSER_CONTEXT_STRIP_SNIPPET = `import {
  ComposerContextStrip,
  ComposerContextStripRow,
} from '@no996/ui/composer-context-strip';
import { AttachmentUploader } from '@no996/ui/attachment-uploader';

<ComposerContextStrip>
  <ComposerContextStripRow
    kind="ppt-template"
    icon={<PresentationIcon className="size-3.5" />}
    label="模板：深蓝决策"
    mention="深蓝决策"
    onDismiss={clearTemplate}
  />
</ComposerContextStrip>`;

const WIZARD_SNIPPET = `import { WizardSteps } from '@no996/ui/feedback';

<WizardSteps
  variant="number"
  steps={[
    { id: '1', label: '基本信息', description: '填写名称' },
    { id: '2', label: '规格配置', description: '选择属性' },
  ]}
  activeIndex={0}
/>`;

const MODULE_FORM_SNIPPET = `import {
  FormSheet,
  FormSection,
  FormSectionBody,
  FormField,
  FloatingInput,
  FloatingSelect,
  FormRow,
} from '@no996/ui/module-form';

<FormSheet>
  <FormSection index="01" title="基础信息">
    <FormSectionBody>
      <FormField labelMode="floating">
        <FloatingInput label="产品名称" required />
      </FormField>
    </FormSectionBody>
  </FormSection>
</FormSheet>`;

const MEDIA_GENERATION_STAGE_SNIPPET = `import { MediaGenerationStage } from '@no996/ui';

<MediaGenerationStage
  kind="image"
  phase="running"
  startedAt={Date.now()}
  onRetry={() => {}}
/>`;

const MODULE_RECORD_LIST_SNIPPET = `import { ModuleRecordList } from '@no996/ui/module-record-list';

<ModuleRecordList
  pageSize={5}
  items={records}
  labels={{ sectionTitle: '最近记录', open: '继续处理', delete: '删除' }}
/>`;

const IMAGE_PREVIEW_SNIPPET = `import { ImagePreviewThumb, PreviewableImage } from '@no996/ui/image-preview';

<ImagePreviewThumb src={imgUrl} alt="预览" label="封面" />`;

const TABLE_SNIPPET = `import { DataTable } from '@no996/ui/data-table';

<DataTable
  rowKey="id"
  columns={columns}
  dataSource={rows}
  resizable
  reorderable
  defaultSort={{ key: 'points', direction: 'desc' }}
/>`;

const AI_SKELETON_SNIPPET = `import { AISkeletonResult } from '@no996/ui';

<AISkeletonResult variant="report" />
<AISkeletonResult variant="cards" cardCount={2} />
<AISkeletonResult variant="article" fill />`;

const AI_TASK_BUTTON_SNIPPET = `import { AITaskButton } from '@no996/ui';

<AITaskButton>AI 生成文案</AITaskButton>
<AITaskButton loading loadingText="正在生成文案...">AI 生成文案</AITaskButton>
<AITaskButton canCancel loading onCancel={handleCancel}>AI 生成文案</AITaskButton>`;

const AI_TASK_PROGRESS_SNIPPET = `import { AITaskProgress } from '@no996/ui';

<AITaskProgress
  title="生成口播文案"
  stages={stages}
  currentStageIndex={1}
  status="running"
  canCancel
  onCancel={handleCancel}
/>`;

const CHAT_COMPOSER_SNIPPET = `import { ComposerStandardsDemo } from './ComposerStandardsDemo';

<ComposerStandardsDemo />`;

const AI_THINKING_SNIPPET = `import { AIThinkingBubble } from '@no996/ui';

<AIThinkingBubble
  running
  headline="正在分析选题..."
  text="思考过程文本"
  canCancel
  onCancel={handleCancel}
/>`;

const STRUCTURED_DOCUMENT_SNIPPET = `import { StructuredDocument } from '@no996/ui/structured-document';

<StructuredDocument
  sections={sections}
  mode="read"
  exportRoot="insight-report"
/>`;

const DOCUMENT_EXPORT_SNIPPET = `import { DocumentExportMenu } from '@no996/ui/document-export';

<DocumentExportMenu
  suggestedBaseName="产品洞察报告"
  getMarkdown={() => markdown}
  getHtmlDocument={() => html}
  desktopBinaryExport={false}
/>`;

const WORKFLOW_CANVAS_SNIPPET = `import { WorkflowCanvas } from '@no996/ui';

// 分支节点始终属于 nodes 拓扑；运行态只决定哪条路径已命中。
const nodes = [
  { id: 'start', title: '用户提交需求', type: 'input' },
  { id: 'check', title: 'IF：检索成功？', type: 'guard', deps: ['start'] },
  { id: 'success', title: '成功：使用检索来源', type: 'tool', deps: ['check'] },
  { id: 'fallback', title: '失败：纯模型兜底', type: 'llm', deps: ['check'] },
  { id: 'next', title: '继续生成', type: 'llm', deps: ['success', 'fallback'] },
];

<WorkflowCanvas
  title="AI 协同生产流程大图"
  nodes={nodes}
  runtimeState={runtimeState}
/>`;

const STAGE_PROGRESS_SNIPPET = `import { WorkflowRunCard } from '@/components/agent/WorkflowRunCard';

<WorkflowRunCard
  title="爆款标题"
  status="running"
  chips={["目标受众：职场新人"]}
  snapshot={snapshot}
  defs={TITLES_STAGES}
  mock
  onCancel={cancel}
/>`;

const FLOW_EXPLAIN_SNIPPET = `import { FlowExplain } from '@no996/ui';

<FlowExplain steps={steps} lang="zh" />`;

const AI_EDIT_POPOVER_SNIPPET = `import { AIEditPopover } from '@no996/ui/ai-edit-popover';

<AIEditPopover
  fieldLabel="主要业务"
  value={value}
  result={suggestion}
  busy={busy}
  quickPrompts={quickPrompts}
  labels={labels}
  onGenerate={generateSuggestion}
  onApply={adoptSuggestion}
  onDismiss={dismissSuggestion}
/>`;

const PROGRESS_STAGES = [
  { key: 'analyze', label: '理解选题', desc: '分析口播主题与受众' },
  { key: 'draft', label: '撰写文案', desc: '生成口播标题与正文' },
  { key: 'split', label: '拆分字幕', desc: '按标点断句为字幕段' },
  { key: 'polish', label: '润色收尾', desc: '检查语气与时长' },
] as const;

const CATALOG_ORDER = [
  'structured-document',
  'document-export',
  'button',
  'wizard',
  'ai-task-button',
  'ai-thinking-bubble',
  'ai-edit-popover',
  'chat-composer',
  'composer-context-strip',
  'glass-menu',
  'ai-skeleton',
  'module-form',
  'attachment-uploader',
  'table',
  'ai-task-progress',
  'dialog',
  'image-preview',
  'media-generation-stage',
  'record-list',
  'workflow-canvas',
  'stage-progress',
  'flow-explain',
] as const;

const SECTION_LAYOUT: Record<string, 'compact' | 'wide'> = {
  'structured-document': 'wide',
  'document-export': 'compact',
  button: 'wide',
  wizard: 'wide',
  'ai-task-button': 'compact',
  'ai-thinking-bubble': 'compact',
  'ai-edit-popover': 'wide',
  'chat-composer': 'compact',
  'composer-context-strip': 'compact',
  'glass-menu': 'wide',
  'ai-skeleton': 'wide',
  'module-form': 'wide',
  'attachment-uploader': 'wide',
  table: 'wide',
  'ai-task-progress': 'wide',
  dialog: 'wide',
  'image-preview': 'wide',
  'media-generation-stage': 'compact',
  'record-list': 'compact',
  'workflow-canvas': 'wide',
  'stage-progress': 'wide',
  'flow-explain': 'compact',
};

function matchStandardsQuery(
  query: string,
  item: { title: string; desc: string; keywords: string[] },
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    item.desc.toLowerCase().includes(q) ||
    item.keywords.some((k) => k.toLowerCase().includes(q))
  );
}

function groupCatalogRows(ids: readonly string[]): Array<{ key: string; ids: string[] }> {
  const rows: Array<{ key: string; ids: string[] }> = [];
  let pendingPair: string[] = [];

  for (const id of ids) {
    if (SECTION_LAYOUT[id] === 'wide') {
      if (pendingPair.length > 0) {
        rows.push({ key: pendingPair.join('-'), ids: pendingPair });
        pendingPair = [];
      }
      rows.push({ key: id, ids: [id] });
    } else {
      pendingPair.push(id);
      if (pendingPair.length === 2) {
        rows.push({ key: pendingPair.join('-'), ids: pendingPair });
        pendingPair = [];
      }
    }
  }

  if (pendingPair.length > 0) {
    rows.push({ key: pendingPair.join('-'), ids: pendingPair });
  }

  return rows;
}

interface CodeDialogPayload {
  title: string;
  snippet: string;
}

function StandardsCatalogTile({
  id,
  title,
  desc,
  snippet,
  layout = 'compact',
  onViewCode,
  children,
  className,
  previewActions,
}: {
  id: string;
  title: string;
  desc: string;
  snippet: string;
  layout?: 'compact' | 'wide';
  onViewCode: (payload: CodeDialogPayload) => void;
  children: ReactNode;
  className?: string;
  previewActions?: ReactNode;
}) {
  const layoutClass = layout === 'wide' ? ' assets-standards-tile--wide' : '';

  return (
    <article
      className={`assets-standards-tile${layoutClass}${className ? ` ${className}` : ''}`}
      data-standards-id={id}
      data-layout={layout}
    >
      <div className="assets-standards-tile__head">
        <span className="assets-standards-tile__head-text">
          <span className="assets-standards-tile__title">{title}</span>
          <span className="assets-standards-tile__desc">{desc}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="assets-standards-tile__code-btn"
          onClick={() => onViewCode({ title, snippet })}
        >
          <Code2 className="size-3.5" aria-hidden />
          查看代码
        </Button>
      </div>

      <div className="assets-standards-tile__preview">
        {previewActions ? (
          <div className="assets-standards-tile__preview-actions">{previewActions}</div>
        ) : null}
        <div className="assets-standards-tile__preview-body">{children}</div>
      </div>
    </article>
  );
}

const WIZARD_DEMO_STEPS = [
  { id: 'basic', label: '基础信息', description: '名称与类目' },
  { id: 'sku', label: '规格库存', description: 'SKU 与价格' },
  { id: 'media', label: '媒体详情', description: '图片与描述' },
];

function MediaGenerationStageStandardsDemo() {
  const [kind, setKind] = useState<MediaGenerationKind>('image');
  const [phase, setPhase] = useState<MediaGenerationStagePhase>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const start = () => {
    setStartedAt(Date.now());
    setPhase('running');
  };
  const finish = () => setPhase('success');
  const fail = () => setPhase('error');

  return (
    <div className="assets-component-preview space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['image', 'video', 'audio'] as const).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={kind === item ? 'default' : 'outline'}
            onClick={() => {
              setKind(item);
              setPhase('idle');
              setStartedAt(null);
            }}
          >
            {item === 'image' ? '图片' : item === 'video' ? '视频' : '音频'}
          </Button>
        ))}
      </div>
      <MediaGenerationStage kind={kind} phase={phase} startedAt={startedAt} onRetry={start} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={start}>开始生成</Button>
        <Button type="button" size="sm" variant="secondary" onClick={finish}>模拟完成</Button>
        <Button type="button" size="sm" variant="outline" onClick={fail}>模拟失败</Button>
      </div>
    </div>
  );
}

function AgentProgressPanelStandardsDemo() {
  const [running, setRunning] = useState(true);
  const snapshot: AgentRunSnapshot = {
    flowId: 'titles-generate',
    round: 1,
    status: running ? 'running' : 'cancelled',
    stages: TITLES_STAGES.map((stage) => ({
      id: stage.id,
      status: stage.order < 4 ? 'done' : stage.id === 'writer' ? (running ? 'running' : 'skipped') : 'idle',
      headline: stage.id === 'writer' && running ? stage.headline : undefined,
      startedAt: stage.id === 'writer' && running ? Date.now() - 1800 : undefined,
      finishedAt: stage.order < 4 ? Date.now() - (4 - stage.order) * 2200 : undefined,
      output: stage.id === 'understander' ? '提取出目标受众与核心诉求' : undefined,
      streamingContent: stage.id === 'writer' && running ? '先把重复工作交给工具，准时下班从这一步开始。' : undefined,
    })),
  };

  return (
    <div className="assets-stage-progress-demo">
      <WorkflowRunCard
        title="爆款标题"
        activeRoleLabel={running ? TITLES_STAGES.find((stage) => stage.id === 'writer')?.roleName : undefined}
        status={running ? 'running' : 'cancelled'}
        chips={[]}
        mock
        streamingText={running ? '先把重复工作交给工具，准时下班从这一步开始。' : undefined}
        snapshot={snapshot}
        defs={TITLES_STAGES}
        onCancel={running ? () => setRunning(false) : undefined}
        onRetry={() => setRunning(true)}
      />
    </div>
  );
}


function WizardStandardsDemo() {
  const [variant, setVariant] = useState<WizardStepsVariant>('number');
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="assets-wizard-demo">
      <div className="assets-wizard-demo__variants">
        {(['dot', 'number', 'line', 'vertical'] as const).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={variant === item ? 'default' : 'outline'}
            onClick={() => setVariant(item)}
          >
            {item === 'dot' ? '点线' : item === 'number' ? '数字' : item === 'line' ? '下划线' : '竖向'}
          </Button>
        ))}
      </div>
      <WizardSteps
        variant={variant}
        steps={WIZARD_DEMO_STEPS}
        activeIndex={activeIndex}
        onStepClick={setActiveIndex}
      />
      <div className="assets-wizard-demo__ctrl">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
        >
          上一步
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={activeIndex >= WIZARD_DEMO_STEPS.length - 1}
          onClick={() => setActiveIndex((value) => Math.min(WIZARD_DEMO_STEPS.length - 1, value + 1))}
        >
          下一步
        </Button>
        <span className="assets-wizard-demo__tip">
          第 <b>{activeIndex + 1}</b> / {WIZARD_DEMO_STEPS.length} 步
        </span>
      </div>
    </div>
  );
}

function ModuleFormStandardsDemo() {
  const [name, setName] = useState('轻衡随行营养杯');
  const [description, setDescription] = useState('用日常语言描述产品特点');
  const [productType, setProductType] = useState('cup');
  const [productId, setProductId] = useState('p1');
  const [purpose, setPurpose] = useState('all');
  const nameError = name.trim() ? '' : '请输入产品名称';

  return (
    <FormSheet>
      <FormSection index="01" title="基础信息" description="业务表单统一入口（替代原生 Input/Textarea 与散乱排版）">
        <FormSectionBody>
          <FormField labelMode="floating" hint="保存产品时必填" error={nameError}>
            <FloatingInput
              label="产品名称"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(nameError)}
            />
          </FormField>
          <FloatingTextarea
            label="产品介绍"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormRow columns={2}>
            <FloatingSelect
              label="产品类型"
              value={productType}
              onValueChange={setProductType}
              options={[
                { value: 'cup', label: '便携杯' },
                { value: 'bottle', label: '保温壶' },
              ]}
            />
            <FormSearchField
              options={[
                { value: 'p1', label: '轻衡随行营养杯', hint: '便携杯' },
                { value: 'p2', label: '恒温随行壶', hint: '保温壶' },
              ]}
              value={productId}
              onChange={setProductId}
              placeholder="选择产品"
              searchPlaceholder="搜索产品名称…"
            />
          </FormRow>
          <ChipToggleGroup
            mode="single"
            label="视觉任务用途"
            value={purpose}
            onChange={(value) => setPurpose(String(value))}
            options={[
              { value: 'main', label: '主图' },
              { value: 'poster', label: '海报' },
              { value: 'all', label: '整套方案' },
            ]}
          />
        </FormSectionBody>
      </FormSection>
    </FormSheet>
  );
}

function AttachmentUploaderDemo() {
  const [imageItems, setImageItems] = useState<AttachmentUploaderItem[]>([]);
  const [videoItems, setVideoItems] = useState<AttachmentUploaderItem[]>([]);
  const [audioItems, setAudioItems] = useState<AttachmentUploaderItem[]>([]);
  const [docItems, setDocItems] = useState<AttachmentUploaderItem[]>([]);
  const [allItems, setAllItems] = useState<AttachmentUploaderItem[]>([]);

  const addItems = (
    setter: Dispatch<SetStateAction<AttachmentUploaderItem[]>>,
    files: File[],
    maxCount: number,
  ) => {
    const drafts = createAttachmentDrafts(files);
    setter((prev) => [...prev, ...drafts].slice(0, maxCount));
  };

  const removeItem = (
    setter: Dispatch<SetStateAction<AttachmentUploaderItem[]>>,
    id: string,
  ) => {
    setter((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && 'file' in target && target.file) releaseAttachmentDrafts([target as ReturnType<typeof createAttachmentDrafts>[number]]);
      return prev.filter((item) => item.id !== id);
    });
  };

  return (
    <div className="assets-component-card__stack">
      <div className="assets-component-preview">
        <p className="assets-component-preview__label">image · grid · max 9</p>
        <AttachmentUploader
          kind="image"
          maxCount={9}
          items={imageItems}
          onAdd={(files) => addItems(setImageItems, files, 9)}
          onRemove={(id) => removeItem(setImageItems, id)}
        />
      </div>
      <div className="assets-component-preview">
        <p className="assets-component-preview__label">video · grid</p>
        <AttachmentUploader
          kind="video"
          maxCount={3}
          items={videoItems}
          onAdd={(files) => addItems(setVideoItems, files, 3)}
          onRemove={(id) => removeItem(setVideoItems, id)}
        />
      </div>
      <div className="assets-component-preview">
        <p className="assets-component-preview__label">audio · list</p>
        <AttachmentUploader
          kind="audio"
          layout="list"
          maxCount={5}
          items={audioItems}
          onAdd={(files) => addItems(setAudioItems, files, 5)}
          onRemove={(id) => removeItem(setAudioItems, id)}
        />
      </div>
      <div className="assets-component-preview">
        <p className="assets-component-preview__label">doc · list</p>
        <AttachmentUploader
          kind="doc"
          layout="list"
          maxCount={5}
          items={docItems}
          onAdd={(files) => addItems(setDocItems, files, 5)}
          onRemove={(id) => removeItem(setDocItems, id)}
        />
      </div>
      <div className="assets-component-preview">
        <p className="assets-component-preview__label">all · auto</p>
        <AttachmentUploader
          kind="all"
          maxCount={6}
          items={allItems}
          onAdd={(files) => addItems(setAllItems, files, 6)}
          onRemove={(id) => removeItem(setAllItems, id)}
        />
      </div>
    </div>
  );
}

export default function ComponentCatalogPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('workbench');
  const [searchQuery, setSearchQuery] = useState('');
  const [codeDialog, setCodeDialog] = useState<CodeDialogPayload | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [liquidGlassDark, setLiquidGlassDark] = useState(false);
  const [glassPreviewDark, setGlassPreviewDark] = useState(true);
  const [buttonDemoLoading, setButtonDemoLoading] = useState(false);
  const [buttonDemoView, setButtonDemoView] = useState('work');
  useEffect(() => {
    if (!buttonDemoLoading) return;
    const timer = window.setTimeout(() => setButtonDemoLoading(false), 1500);
    return () => window.clearTimeout(timer);
  }, [buttonDemoLoading]);
  const [aiTaskLoading, setAiTaskLoading] = useState(false);
  const [aiCancellable, setAiCancellable] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<string | null>('p1');

  useEffect(() => () => clearComponentCatalogAccess(), []);

  const sectionMeta = useMemo(
    () => [
      {
        id: 'structured-document',
        title: 'StructuredDocument 结构化长文档',
        desc: 'AI 洞察报告 / 多章节卡片 / 宽屏三列行组 / 无边框阅读',
        keywords: ['structured', 'document', 'insight', '报告', '长文档', 'markdown', '章节'],
      },
      {
        id: 'document-export',
        title: 'DocumentExport 文档导出',
        desc: 'Markdown / HTML / PNG 多格式导出菜单',
        keywords: ['export', '导出', 'png', 'html', 'markdown'],
      },
      {
        id: 'button',
        title: 'Button & Liquid Glass 按钮与毛玻璃体系',
        desc: 'GlassButton 3D俯仰+渐变边缘 / GlassPanel 1px渐变折射+微光斑 / GlassBadge 胶囊徽章',
        keywords: ['button', '按钮', 'glass', 'liquid', 'panel', 'badge', '毛玻璃', '光斑', '渐变', '3d'],
      },
      { id: 'wizard', title: 'WizardSteps 步骤向导', desc: '数字 / 点线 / 下划线 / 竖向四种形态，统一多步流程导航', keywords: ['wizard', '步骤', 'stepper', '向导', 'steps'] },
      { id: 'ai-task-button', title: 'AITaskButton 任务按钮', desc: 'idle / loading / canCancel', keywords: ['ai', 'task', 'button', '生成', 'loading'] },
      { id: 'ai-thinking-bubble', title: 'AIThinkingBubble 思考气泡', desc: '会话思考过程折叠气泡', keywords: ['ai', 'thinking', '思考', '气泡', 'bubble'] },
      { id: 'ai-edit-popover', title: 'AIEditPopover AI 润色对话框', desc: '字段上下文、快捷润色方向、结果预览与采用', keywords: ['ai', 'edit', 'polish', '润色', '优化', 'popover'] },
      {
        id: 'chat-composer',
        title: 'ChatComposer 对话输入框',
        desc: 'Hero / Dock / 悬浮胶囊三态统一输入交互',
        keywords: ['composer', 'chat', '输入', '对话框', 'hero', 'dock'],
      },
      {
        id: 'composer-context-strip',
        title: 'ComposerContextStrip 上下文长条',
        desc: 'PPT 模板 / 页面分享 / inline 附件统一长条容器',
        keywords: ['composer', 'strip', 'context', 'attachment', 'ppt', '分享', '长条'],
      },
      { id: 'glass-menu', title: 'GlassMenu 浮层菜单', desc: 'backdrop-filter 毛玻璃 / 深浅色变量 / 居中对照', keywords: ['menu', 'dropdown', '菜单', 'popover', 'glass', '浮层', 'blur', '毛玻璃'] },
      { id: 'ai-skeleton', title: 'AISkeletonResult 骨架屏', desc: 'report / cards / article / form', keywords: ['ai', 'skeleton', '骨架', 'loading', '占位'] },
      { id: 'module-form', title: 'Module Form 模块录入', desc: '业务表单统一入口：浮动标签 / Select / 搜索选择 / Chip / 分区卡片', keywords: ['module-form', 'field', 'floating', 'chip', '表单', '录入', 'input', 'select', 'textarea'] },
      { id: 'attachment-uploader', title: 'AttachmentUploader 附件上传', desc: 'kind / layout / 预览 / 进度', keywords: ['upload', 'attachment', '附件', '上传', 'file', 'dropzone'] },
      { id: 'table', title: 'DataTable 表格', desc: '虚拟滚动 / 列宽拖拽 / 排序 / 空态 / 分页', keywords: ['table', '表格', 'datatable', '分页', '虚拟'] },
      { id: 'ai-task-progress', title: 'AITaskProgress 任务进度', desc: '阶段进度 + 阻尼条', keywords: ['ai', 'progress', '进度', '阶段', '任务'] },
      { id: 'dialog', title: 'Dialog 弹窗与反馈', desc: 'ActionDialog / ConfirmDialog / FormDialog / SearchPickerDialog', keywords: ['dialog', '弹窗', 'alert', 'progress', 'empty', 'badge'] },
      { id: 'image-preview', title: 'ImagePreview 图片预览', desc: '缩略图点击查看大图，生图卡片与资产库复用', keywords: ['image', 'preview', '图片', '大图', '缩略图', 'zoom'] },
      {
        id: 'media-generation-stage',
        title: 'MediaGenerationStage 媒体生成中',
        desc: '生图/生视频/生音频共用的加载舞台',
        keywords: ['media', 'generation', '生成', '图片', '视频', '音频', 'loading', '进度'],
      },
      { id: 'record-list', title: 'ModuleRecordList 任务列表', desc: '公众号 / 视觉方案 / 宣传主视觉列表复用，支持分页', keywords: ['list', '列表', '任务', 'record', '分页', '翻页'] },
      { id: 'workflow-canvas', title: 'WorkflowCanvas 流程拓扑画布', desc: 'DAG 拓扑、条件分支命中状态、回放轴与详情抽屉', keywords: ['workflow', 'canvas', 'dag', '拓扑', '流程', '分支', '画布', '回放'] },
      { id: 'stage-progress', title: 'AgentProgress 生成进度面板', desc: '紧凑百分比进度 / 步骤切换 / SVG 流程详情 / 可取消', keywords: ['stage', 'workflow', 'progress', '步骤', '进度条', '流式'] },
      { id: 'flow-explain', title: 'FlowExplain 生产流程说明', desc: 'N 位 AI 专家协同，M 个环节接力完成', keywords: ['explain', '流程', '说明', '专家', '环节'] },
    ],
    [],
  );

  const visibleSectionIds = useMemo(
    () =>
      CATALOG_ORDER.filter((id) => {
        const meta = sectionMeta.find((row) => row.id === id);
        return meta ? matchStandardsQuery(searchQuery, meta) : false;
      }),
    [sectionMeta, searchQuery],
  );

  const catalogRows = useMemo(() => groupCatalogRows(visibleSectionIds), [visibleSectionIds]);

  const handleViewCode = useCallback((payload: CodeDialogPayload) => {
    setCodeDialog(payload);
    setCopiedCode(false);
  }, []);

  const handleCopyCode = async () => {
    if (!codeDialog) return;
    try {
      await navigator.clipboard.writeText(codeDialog.snippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const tileProps = useCallback(
    (id: string) => ({
      id,
      layout: SECTION_LAYOUT[id] ?? 'compact',
      onViewCode: handleViewCode,
    }),
    [handleViewCode],
  );

  const columns: DataColumn<DemoRow>[] = [
    { title: '标题', dataIndex: 'name', ellipsis: true, sortable: true },
    { title: '平台', dataIndex: 'platform', width: 120 },
    { title: '消耗积分', dataIndex: 'points', width: 100, sortable: true, align: 'right' },
    {
      title: '操作',
      key: 'actions',
      isActions: true,
      width: 120,
      render: () => (
        <div className="flex gap-1">
          <IconActionButton icon={<Pencil />} label="编辑" onClick={() => {}} />
          <IconActionButton icon={<Trash2 />} label="删除" variant="danger" onClick={() => {}} />
        </div>
      ),
    },
  ];

  const demoPreviewSrc = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23e65f2b"/><stop offset="100%" stop-color="%2338bdf8"/></linearGradient></defs><rect width="400" height="300" fill="%231e1e24"/><circle cx="200" cy="150" r="80" fill="url(%23g)" opacity="0.8"/><text x="200" y="155" fill="%23fff" font-family="sans-serif" font-size="16" font-weight="600" text-anchor="middle">DEMO PREVIEW</text></svg>';

  const renderCatalogSection = (id: string) => {
    switch (id) {
      case 'structured-document':
        return (
          <StandardsCatalogTile
            title="StructuredDocument 结构化长文档"
            desc="summary-grid / audience-grid / pill-stack / chain-stack / strategy-hero"
            snippet={STRUCTURED_DOCUMENT_SNIPPET}
            {...tileProps('structured-document')}
          >
            <StructuredDocumentStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'document-export':
        return (
          <StandardsCatalogTile
            title="DocumentExport 文档导出"
            desc="Markdown / HTML / PNG"
            snippet={DOCUMENT_EXPORT_SNIPPET}
            {...tileProps('document-export')}
          >
            <DocumentExportStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'button':
        return (
          <StandardsCatalogTile
            title="Button & Liquid Glass 按钮与毛玻璃体系"
            desc="GlassButton 3D俯仰+渐变边缘 / GlassPanel 1px渐变折射+微光斑 / GlassBadge 胶囊徽章"
            snippet={BUTTON_SNIPPET}
            previewActions={
              <button
                type="button"
                className="assets-standards-tile__theme-toggle"
                aria-label={liquidGlassDark ? '切换为浅色预览' : '切换为深色预览'}
                onClick={(event) => {
                  event.stopPropagation();
                  setLiquidGlassDark((value) => !value);
                }}
              >
                {liquidGlassDark ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
                {liquidGlassDark ? '浅色' : '深色'}
              </button>
            }
            {...tileProps('button')}
          >
            <div
              className={`assets-standards-local-theme--${liquidGlassDark ? 'dark' : 'light'} p-6 rounded-2xl transition-colors duration-300 bg-[var(--background)]`}
            >
              {/* 1. 双面板毛玻璃折射区 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <GlassPanel>
                  <div className="panel-body">
                    <div className="panel-icon">
                      <SparklesIcon className="size-5" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">Liquid Glass 面板</h3>
                    <p className="text-xs text-muted-foreground mb-3">1px 渐变描边 + 内阴影高光 + 背景模糊，边缘在浅色与深色下都保持干净锐利。</p>
                    <div className="panel-footer flex items-center justify-between">
                      <GlassButton size="sm">Explore</GlassButton>
                      <GlassBadge>Stable</GlassBadge>
                    </div>
                  </div>
                </GlassPanel>

                <GlassPanel>
                  <div className="panel-body">
                    <div className="panel-icon">
                      <Layers className="size-5" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">Edge System 边缘体系</h3>
                    <p className="text-xs text-muted-foreground mb-3">外圈渐变描边勾勒轮廓，内圈 inset 高光负责体积感，两者叠加模拟玻璃的边缘反光。</p>
                    <div className="panel-footer flex items-center gap-2">
                      <GlassBadge>Edge · 1px</GlassBadge>
                      <GlassBadge>Blur · 18px</GlassBadge>
                    </div>
                  </div>
                </GlassPanel>
              </div>

              {/* 2. 全局通用按钮变体 */}
              <div className="space-y-3 mb-4">
                <div className="text-xs font-medium text-foreground/60">全局通用按钮 (Button)</div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>新建产品</Button>
                  <Button variant="secondary">次要操作</Button>
                  <Button variant="outline">查看详情</Button>
                  <Button variant="ghost">取消</Button>
                  <Button variant="destructive">删除</Button>
                  <Button disabled>禁用状态</Button>
                </div>
              </div>

              {/* 与人设页及标题页使用相同的公共实现，无页面祖先样式依赖。 */}
              <div className="space-y-3 mb-4">
                <div className="text-xs font-medium text-foreground/60">工作台工具栏与生成按钮</div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="toolbar">新建人设</Button>
                  <Tabs value={buttonDemoView} onValueChange={(value) => setButtonDemoView(String(value))}>
                    <TabsList variant="toolbar" aria-label="示例视图">
                      <TabsTrigger value="work">创作</TabsTrigger>
                      <TabsTrigger value="history">记录</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="generate" size="action">开始生成</Button>
                  <Button variant="generate" size="action" disabled aria-busy="true">生成中…</Button>
                </div>
              </div>

              {/* 3. 交互高阶 GlassButton 与徽章 */}
              <div className="space-y-3 pt-4 border-t border-border/20">
                <div className="text-xs font-medium text-foreground/60">高阶 3D 按钮 (GlassButton) 与状态徽章</div>
                <div className="flex flex-wrap items-center gap-3">
                  <GlassButton size="sm">小尺寸</GlassButton>
                  <GlassButton size="default">标准尺寸</GlassButton>
                  <GlassButton
                    size="lg"
                    loading={buttonDemoLoading}
                    onClick={() => setButtonDemoLoading((value) => !value)}
                  >
                    {buttonDemoLoading ? '加载中…' : '切换加载态'}
                  </GlassButton>
                  <GlassButton size="icon" aria-label="闪电">
                    <SparklesIcon className="size-4" />
                  </GlassButton>
                  <GlassButton disabled>禁用</GlassButton>
                  <GlassBadge>Default</GlassBadge>
                  <GlassBadge>In Progress</GlassBadge>
                  <GlassBadge>v2.0.1</GlassBadge>
                </div>
              </div>
            </div>
          </StandardsCatalogTile>
        );
      case 'wizard':
        return (
          <StandardsCatalogTile
            title="WizardSteps 步骤向导"
            desc="数字 / 点线 / 下划线 / 竖向四种形态，统一多步流程导航"
            snippet={WIZARD_SNIPPET}
            {...tileProps('wizard')}
          >
            <WizardStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'ai-task-button':
        return (
          <StandardsCatalogTile
            title="AITaskButton 任务按钮"
            desc="idle / loading / canCancel"
            snippet={AI_TASK_BUTTON_SNIPPET}
            {...tileProps('ai-task-button')}
          >
            <div className="assets-component-card__row">
              <AITaskButton>AI 生成文案</AITaskButton>
              <AITaskButton loading loadingText="正在生成文案...">AI 生成文案</AITaskButton>
              <AITaskButton
                canCancel
                loading={aiCancellable}
                loadingText="正在生成文案..."
                onClick={() => setAiCancellable((prev) => !prev)}
                onCancel={() => setAiCancellable(false)}
              >
                AI 生成文案
              </AITaskButton>
              <AITaskButton
                variant="outline"
                loading={aiTaskLoading}
                loadingText="提交中..."
                onClick={() => setAiTaskLoading((prev) => !prev)}
              >
                切换 loading
              </AITaskButton>
            </div>
          </StandardsCatalogTile>
        );
      case 'ai-thinking-bubble':
        return (
          <StandardsCatalogTile
            title="AIThinkingBubble 思考气泡"
            desc="会话思考过程折叠气泡"
            snippet={AI_THINKING_SNIPPET}
            {...tileProps('ai-thinking-bubble')}
          >
            <AIThinkingBubble
              running
              headline="正在分析选题与受众画像..."
              text="先确定口播的核心观点，再围绕痛点展开三段式结构：开场钩子、价值阐述、行动号召。"
              defaultExpanded
              canCancel
              onCancel={() => {}}
            />
          </StandardsCatalogTile>
        );
      case 'ai-edit-popover':
        return (
          <StandardsCatalogTile
            title="AIEditPopover 字段润色对话框"
            desc="字段上下文、自然语言要求、快捷方向、结果预览与采用"
            snippet={AI_EDIT_POPOVER_SNIPPET}
            {...tileProps('ai-edit-popover')}
          >
            <AIEditPopoverStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'chat-composer':
        return (
          <StandardsCatalogTile
            title="ChatComposer 对话输入框"
            desc="Hero / Dock 会话 / 输入胶囊三态统一输入交互"
            snippet={CHAT_COMPOSER_SNIPPET}
            {...tileProps('chat-composer')}
          >
            <ComposerStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'composer-context-strip':
        return (
          <StandardsCatalogTile
            title="ComposerContextStrip 上下文长条"
            desc="PPT 模板 / 页面分享行 + composer 横滑附件大卡"
            snippet={COMPOSER_CONTEXT_STRIP_SNIPPET}
            {...tileProps('composer-context-strip')}
          >
            <ComposerContextStripStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'glass-menu':
        return (
          <StandardsCatalogTile
            title="GlassMenu 浮层菜单"
            desc="backdrop-filter 毛玻璃 / 深浅色变量 / 居中对照"
            snippet={GLASS_MENU_SNIPPET}
            previewActions={
              <button
                type="button"
                className="assets-standards-tile__theme-toggle"
                onClick={() => setGlassPreviewDark((v) => !v)}
              >
                {glassPreviewDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                {glassPreviewDark ? '浅色' : '深色'}
              </button>
            }
            {...tileProps('glass-menu')}
          >
            <div
              className={`assets-glass-menu-stage assets-standards-local-theme--${glassPreviewDark ? 'dark' : 'light'}`}
            >
              <GlassMenu className="assets-glass-menu-stage__menu">
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[11px] font-semibold tracking-wider uppercase opacity-60">常用工具菜单</p>
                </div>
                {GLASS_MENU_REFERENCE_ITEMS.map((row) => (
                  <GlassMenuItem key={row.label} icon={row.icon}>
                    {row.label}
                  </GlassMenuItem>
                ))}
                <GlassMenuSeparator />
                <GlassMenuItem icon="📂">管理本地资产</GlassMenuItem>
              </GlassMenu>
            </div>
            <div className="assets-component-card__row assets-glass-menu-dropdowns mt-3">
              <GlassMenuDropdown>
                <GlassMenuDropdownTrigger render={<Button variant="outline">打开浮层下拉</Button>} />
                <GlassMenuDropdownContent align="start" className="w-56">
                  <GlassMenuGroupLabel>产出类别</GlassMenuGroupLabel>
                  <GlassMenuDropdownItem>短视频分镜脚本</GlassMenuDropdownItem>
                  <GlassMenuDropdownItem>直播带货话术</GlassMenuDropdownItem>
                  <GlassMenuDropdownItem>小红书种草文案</GlassMenuDropdownItem>
                  <GlassMenuSeparator />
                  <GlassMenuFooter>
                    <GlassMenuDropdownItem>产出中心 · 查看全部</GlassMenuDropdownItem>
                  </GlassMenuFooter>
                </GlassMenuDropdownContent>
              </GlassMenuDropdown>
            </div>
          </StandardsCatalogTile>
        );
      case 'ai-skeleton':
        return (
          <StandardsCatalogTile
            title="AISkeletonResult 骨架屏"
            desc="report / cards / article / form"
            snippet={AI_SKELETON_SNIPPET}
            {...tileProps('ai-skeleton')}
          >
            <div className="assets-component-card__stack">
              <div className="assets-component-preview">
                <p className="assets-component-preview__label">report 报告模式</p>
                <AISkeletonResult variant="report" />
              </div>
              <div className="assets-component-preview">
                <p className="assets-component-preview__label">cards 卡片模式</p>
                <AISkeletonResult variant="cards" cardCount={2} />
              </div>
              <div className="assets-component-preview">
                <p className="assets-component-preview__label">article 文章模式</p>
                <AISkeletonResult variant="article" fill />
              </div>
              <div className="assets-component-preview">
                <p className="assets-component-preview__label">form 表单占位</p>
                <div className="assets-form-context">
                  <AISkeletonResult
                    variant="form"
                    headline="AI 正在创作口播文案，生成完成后将自动填入下方..."
                  />
                </div>
              </div>
            </div>
          </StandardsCatalogTile>
        );
      case 'attachment-uploader':
        return (
          <StandardsCatalogTile
            title="AttachmentUploader 附件上传"
            desc="kind / layout / 预览 / 进度"
            snippet={ATTACHMENT_UPLOADER_SNIPPET}
            {...tileProps('attachment-uploader')}
          >
            <AttachmentUploaderDemo />
          </StandardsCatalogTile>
        );
      case 'module-form':
        return (
          <StandardsCatalogTile
            title="Module Form 模块录入"
            desc="业务表单统一入口：浮动标签 / Select / 搜索选择 / Chip / 分区卡片"
            snippet={MODULE_FORM_SNIPPET}
            {...tileProps('module-form')}
          >
            <ModuleFormStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'table':
        return (
          <StandardsCatalogTile
            title="DataTable 表格"
            desc="虚拟滚动 / 列宽拖拽 / 排序 / 空态 / 分页"
            snippet={TABLE_SNIPPET}
            {...tileProps('table')}
          >
            <DataTable
              rowKey="id"
              columns={columns}
              dataSource={DEMO_ROWS}
              resizable
              reorderable
              rowHeight={48}
              defaultSort={{ key: 'points', direction: 'desc' }}
            />
            <DataTable rowKey="id" columns={columns} dataSource={[]} emptyText="暂无产品记录" />
          </StandardsCatalogTile>
        );
      case 'ai-task-progress':
        return (
          <StandardsCatalogTile
            title="AITaskProgress 任务进度"
            desc="阶段进度 + 阻尼条"
            snippet={AI_TASK_PROGRESS_SNIPPET}
            {...tileProps('ai-task-progress')}
          >
            <AITaskProgress
              title="生成口播文案"
              desc="正在根据选题撰写口播标题与正文"
              agentName="文案助手"
              headline="正在组织开场与核心观点..."
              stages={PROGRESS_STAGES}
              currentStageIndex={1}
              status="running"
              canCancel
              onCancel={() => {}}
            />
          </StandardsCatalogTile>
        );
      case 'dialog':
        return (
          <StandardsCatalogTile
            title="Dialog 弹窗与反馈"
            desc="ActionDialog / ConfirmDialog / FormDialog / SearchPickerDialog"
            snippet={`import { ConfirmDialog, FormDialog } from '@no996/ui/FormDialog';
import { SearchPickerDialog } from '@no996/ui/search-picker-dialog';`}
            {...tileProps('dialog')}
          >
            <ActionBar>
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>打开确认弹窗</Button>
              <Button variant="outline" onClick={() => setFormOpen(true)}>打开表单弹窗</Button>
              <Button variant="outline" onClick={() => setPickerOpen(true)}>打开资源选择器</Button>
            </ActionBar>
            <div className="assets-component-card__row">
              <StatusBadge tone="success" label="洞察已完成" />
              <StatusBadge tone="warning" label="报告待确认" />
              <StatusBadge tone="error" label="生成失败" />
              <Badge variant="outline">已保存</Badge>
            </div>
            <Alert>
              <AlertTitle>标准提示</AlertTitle>
              <AlertDescription>附件只作为洞察分析的补充材料，不会覆盖产品信息。</AlertDescription>
            </Alert>
            <Progress value={60} label="任务进度" />
            <ActivityTimeline
              items={[
                { id: '1', title: '输入产品事实', time: '09:12', tone: 'success' },
                { id: '2', title: '生成消费者洞察', time: '09:14' },
              ]}
            />
            <ResultState status="empty" title="暂无产品记录" description="创建第一个产品，建立事实记忆。" />
            <Empty>
              <EmptyHeader>
                <EmptyMedia><Inbox /></EmptyMedia>
                <EmptyTitle>还没有内容</EmptyTitle>
                <EmptyDescription>新建一篇草稿，从选题开始。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </StandardsCatalogTile>
        );
      case 'image-preview':
        return (
          <StandardsCatalogTile
            title="ImagePreview 图片预览"
            desc="缩略图点击查看大图，生图卡片与资产库复用"
            snippet={IMAGE_PREVIEW_SNIPPET}
            {...tileProps('image-preview')}
          >
            <div className="assets-thumb-grid assets-thumb-grid--hero">
              <ImagePreviewThumb
                src={demoPreviewSrc}
                alt="preview.png"
                title="产品主图预览"
                label="ImagePreviewThumb"
              />
            </div>
            <div className="assets-component-preview">
              <p className="assets-component-preview__label">生图结果预览框</p>
              <PreviewableImage
                src={demoPreviewSrc}
                alt="生成结果示意"
                title="DETAIL-03 · 产品解决方案"
                description="电商详情页生成结果"
                className="visual-gen-preview-frame visual-gen-preview-frame--portrait max-w-sm rounded-lg overflow-hidden border border-border"
              >
                <img src={demoPreviewSrc} alt="生成结果示意" className="h-full w-full object-contain" draggable={false} />
              </PreviewableImage>
            </div>
          </StandardsCatalogTile>
        );
      case 'media-generation-stage':
        return (
          <StandardsCatalogTile
            title="MediaGenerationStage 媒体生成中"
            desc="生图/生视频/生音频共用的加载舞台"
            snippet={MEDIA_GENERATION_STAGE_SNIPPET}
            {...tileProps('media-generation-stage')}
          >
            <MediaGenerationStageStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'record-list':
        return (
          <StandardsCatalogTile
            title="ModuleRecordList 任务列表"
            desc="公众号 / 视觉方案 / 宣传主视觉列表复用，支持分页"
            snippet={MODULE_RECORD_LIST_SNIPPET}
            {...tileProps('record-list')}
          >
            <ModuleRecordList
              pageSize={2}
              items={[
                {
                  id: 'demo-1',
                  title: '竹蜻蜓 · 视觉方案',
                  thumbnail: <SparklesIcon className="size-6 text-primary" aria-hidden />,
                  badges: [{ label: '草稿', tone: 'neutral' }],
                  metaParts: ['2026-09-25'],
                  metaHighlight: '4 张图片',
                },
                {
                  id: 'demo-2',
                  title: '把测试经验变成 AI 能复用的检查清单',
                  badges: [{ label: '已存资产', tone: 'success' }],
                  metaParts: ['当前步骤：标题', '2026-09-23 07:59'],
                  footnote: '基础资料库/内容资产/公众号/…',
                },
              ]}
              labels={{
                sectionTitle: '最近记录',
                open: '继续处理',
                delete: '删除',
              }}
              onOpen={() => {}}
              onDelete={() => {}}
            />
          </StandardsCatalogTile>
        );
      case 'workflow-canvas':
        return (
          <StandardsCatalogTile
            title="WorkflowCanvas 流程拓扑画布"
            desc="DAG 拓扑、条件分支命中状态、回放轴与详情抽屉"
            snippet={WORKFLOW_CANVAS_SNIPPET}
            {...tileProps('workflow-canvas')}
          >
            <div className="h-80 w-full rounded-xl overflow-hidden border border-border bg-card">
              <WorkflowCanvas
                title="AI 协同生产流程拓扑：检索成功 / 兜底分支"
                nodes={[
                  { id: 'start', title: '用户提交需求', type: 'input', order: 1 },
                  { id: 'condition', title: 'IF：联网检索成功？', type: 'guard', deps: ['start'], order: 2 },
                  { id: 'search-success', title: '检索成功：使用来源', type: 'tool', deps: ['condition'], order: 3 },
                  { id: 'search-fallback', title: '检索失败：纯模型兜底', type: 'llm', deps: ['condition'], order: 4 },
                  { id: 'finish', title: '继续生成并交付', type: 'llm', deps: ['search-success', 'search-fallback'], order: 5 },
                ]}
                activeNodeId="finish"
                runtimeState={{
                  start: { status: 'done', text: '需求已接收', startedAt: 0, finishedAt: 120 },
                  condition: { status: 'done', text: '本次检索返回了可用来源，选择成功分支。', startedAt: 120, finishedAt: 300 },
                  'search-success': { status: 'done', text: '来源进入后续生成。', startedAt: 300, finishedAt: 900 },
                  'search-fallback': { status: 'skipped', text: '本次未命中；这条路径保留在流程定义中。', startedAt: 0, finishedAt: 0 },
                  finish: { status: 'running', text: '正在生成标题候选...', startedAt: 900, finishedAt: 0 },
                }}
              />
            </div>
          </StandardsCatalogTile>
        );
      case 'stage-progress':
        return (
          <StandardsCatalogTile
            title="AgentProgress 生成进度面板"
            desc="紧凑百分比进度 / 步骤切换 / SVG 流程详情 / 可取消"
            snippet={STAGE_PROGRESS_SNIPPET}
            {...tileProps('stage-progress')}
          >
            <AgentProgressPanelStandardsDemo />
          </StandardsCatalogTile>
        );
      case 'flow-explain':
        return (
          <StandardsCatalogTile
            title="FlowExplain 生产流程说明"
            desc="用户视角流程交代：N 位 AI 专家与你协同，M 个环节接力完成"
            snippet={FLOW_EXPLAIN_SNIPPET}
            {...tileProps('flow-explain')}
          >
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
              <FlowExplain
                title="了解多专家协同流程"
                steps={[
                  { id: 's1', order: 1, label: '策划架构师', kind: 'model', note: '提炼核心观点与情绪切入点' },
                  { id: 's2', order: 2, label: '爆款编剧', kind: 'model', note: '编写台词与画面说明' },
                  { id: 's3', order: 3, label: '规则校验引擎', kind: 'algo', note: '离线排查平台违禁词' },
                  { id: 's4', order: 4, label: '资深制片人', kind: 'model', note: '节奏把控与完播率优化' },
                ]}
                lang="zh"
              />
              <span className="text-xs text-muted-foreground">点击按钮即可唤起生产流程专家弹层，清晰查看协同架构。</span>
            </div>
          </StandardsCatalogTile>
        );
      default:
        return null;
    }
  };

  return (
    <Page
      moduleId="component-catalog"
      title={t('componentCatalogTitle', { defaultValue: '组件库' })}
      description={t('componentCatalogDescription', { defaultValue: '网页端公共组件的交互预览与使用参考。这里展示的是项目内可直接复用的实现。' })}
      actions={
        <Button variant="outline" onClick={() => navigate('/workbench')}>
          {t('componentCatalogBack', { defaultValue: '返回工作台' })}
        </Button>
      }
      defaultWidth={1200}
      minWidth={560}
    >
      <div className="component-catalog">
        <div className="component-catalog__notice">
          <Badge variant="secondary">{t('componentCatalogInternal', { defaultValue: '内部页面' })}</Badge>
          <p>{t('componentCatalogNotice', { defaultValue: '再次进入：2 秒内连续点击侧栏“桌面端专属”分组 7 次。组件更新后可在这里核对主题、控件状态和组合方式。' })}</p>
        </div>

        {/* 顶部搜索栏 */}
        <div className="assets-standards-toolbar">
          <div className="assets-standards-search">
            <Search className="assets-standards-search__icon" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索组件，例如 button、ai、表格、骨架屏、画布…"
              className="assets-standards-search__input"
              aria-label="搜索标准组件"
            />
            <span className="assets-standards-search__count">
              {visibleSectionIds.length} / {CATALOG_ORDER.length}
            </span>
          </div>
          {searchQuery ? (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              清空搜索
            </Button>
          ) : null}
        </div>

        {visibleSectionIds.length === 0 ? (
          <p className="assets-standards-empty">没有匹配的组件，试试其他关键词。</p>
        ) : (
          <div className="assets-standards-catalog">
            {catalogRows.map((row) => (
              <div
                key={row.key}
                className={`assets-standards-row${row.ids.length === 2 ? ' assets-standards-row--pair' : ''}`}
              >
                {row.ids.map((id) => (
                  <div key={id}>{renderCatalogSection(id)}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 代码查看弹窗 */}
        <Dialog open={Boolean(codeDialog)} onOpenChange={(open) => !open && setCodeDialog(null)}>
          <DialogContent className="assets-standards-code-dialog sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{codeDialog?.title} · 代码示例</DialogTitle>
            </DialogHeader>
            <div className="assets-standards-code-dialog__scroll">
              <pre className="assets-standards-code-dialog__pre">{codeDialog?.snippet}</pre>
            </div>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button type="button" variant="outline" size="sm" onClick={handleCopyCode} className="gap-1.5">
                {copiedCode ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                {copiedCode ? '已复制' : '复制代码'}
              </Button>
              <Button type="button" size="sm" onClick={() => setCodeDialog(null)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 交互演示弹窗 */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="确认删除该产品？"
          description="删除后，相关的历史版本与本地草稿将一并移除，此操作不可撤销。"
          onConfirm={() => setConfirmOpen(false)}
          destructive
          confirmLabel="确认删除"
        />

        <FormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title="编辑产品资料"
          description="更新后将在洞察分析和视频创作中自动同步生效。"
          onSubmit={() => setFormOpen(false)}
          submitLabel="保存修改"
        >
          <div className="space-y-4 py-2">
            <FormField label="产品名称" required>
              <FloatingInput label="产品名称" defaultValue="轻衡随行营养杯" />
            </FormField>
            <FormField label="核心卖点">
              <FloatingTextarea label="核心卖点" defaultValue="便携随行、食品级 Tritan 材质、6小时保冷保热。" />
            </FormField>
          </div>
        </FormDialog>

        <SearchPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="选择参考产品"
          description="选择一个已录入的事实底座，作为本次分析的主体。"
          items={[
            { id: 'p1', title: '轻衡随行营养杯', subtitle: '便携杯 · 350ml' },
            { id: 'p2', title: '恒温随行壶', subtitle: '保温壶 · 500ml' },
            { id: 'p3', title: '纳米级多功能料理锅', subtitle: '厨电 · 智能温控' },
          ]}
          selectedId={pickerSelected}
          onSelect={(id) => {
            setPickerSelected(id);
            setPickerOpen(false);
          }}
        />
      </div>
    </Page>
  );
}
