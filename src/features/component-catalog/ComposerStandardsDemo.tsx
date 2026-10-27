import { useState } from 'react';
import { Sparkles, Paperclip, ArrowUp } from 'lucide-react';
import { Button } from '@no996/ui/button';
import { GlassButton, GlassPanel, GlassBadge } from '@no996/ui';

type ComposerDemoMode = 'hero' | 'dock' | 'capsule';

/** 组件库演示：AI 对话与创作输入区（Hero 居中 / 页面底部 Dock / 浮动胶囊三种形态）。 */
export function ComposerStandardsDemo() {
  const [mode, setMode] = useState<ComposerDemoMode>('hero');
  const [inputVal, setInputVal] = useState('');

  return (
    <div className="assets-composer-standards-demo">
      <div className="assets-composer-standards-demo__toolbar">
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40 gap-1 text-xs">
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${mode === 'hero' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('hero')}
          >
            Hero 居中
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${mode === 'dock' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('dock')}
          >
            底部 Dock
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${mode === 'capsule' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('capsule')}
          >
            浮动胶囊
          </button>
        </div>
        <span className="assets-composer-standards-demo__hint">
          {mode === 'hero' && '页面首屏中央输入形态，带有呼吸微光与场景快捷提示。'}
          {mode === 'dock' && '固定在页面底部的操作区，便于长会话与多步骤交互。'}
          {mode === 'capsule' && '轻量化半透明悬浮胶囊，点击后可向内或向上展开。'}
        </span>
      </div>

      <div className="assets-composer-standards-demo__stage pt-2 pb-2">
        {mode === 'capsule' ? (
          <div className="assets-composer-standards-demo__capsule bg-card/85 backdrop-blur-md border border-border p-2.5 shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 pl-2">
              <Sparkles className="size-4 text-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">有什么想法，随时告诉我...</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GlassBadge>DeepSeek V3</GlassBadge>
              <GlassButton size="sm">唤起</GlassButton>
            </div>
          </div>
        ) : (
          <GlassPanel className={`w-full max-w-2xl mx-auto p-4 transition-all ${mode === 'hero' ? 'shadow-xl' : 'shadow-md'}`}>
            <div className="flex flex-col gap-3">
              <textarea
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={mode === 'hero' ? '输入你想策划的内容、提问或生成要求...' : '回复或输入下一步指令...'}
                rows={mode === 'hero' ? 3 : 2}
                className="w-full bg-transparent resize-none border-0 p-0 text-sm focus:outline-none placeholder:text-muted-foreground"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                    <Paperclip className="size-3.5 mr-1" />
                    <span className="text-xs">添加素材</span>
                  </Button>
                </div>
                <Button size="sm" className="h-8 gap-1 rounded-lg" disabled={!inputVal.trim()}>
                  <span className="text-xs">发送</span>
                  <ArrowUp className="size-3.5" />
                </Button>
              </div>
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
