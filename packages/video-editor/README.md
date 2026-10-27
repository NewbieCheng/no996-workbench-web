# @no996/video-editor

通用、独立、可复用、具备完整剪辑能力的音视频编辑器核心与可组合面板组件包。

## 架构分层

- `src/core/`：纯领域逻辑、文档数据模型（`EditorDocument v1`）、时间微秒高精度模型、原子命令系统（`CommandManager`，最多 50 步撤销重做栈）、持久化仓储（IndexedDB 复合主键 `[scope, id]` 隔离与版本冲突检查）、二进制容器备份、关键帧系统、变速/反放/冻结时域映射、四类转场、滤镜效果与多轨混音限幅算法（零 DOM、零 React 依赖）。
- `src/media/`：音视频元数据探测、解复用、音频采样、带引用计数的资源池 `DefaultResourcePool` 与离线按帧编码调度（由 `mediabunny` 驱动）。
- `src/render/`：统一求值计划 `RenderPlan`、Canvas 2D 离屏画面合成器与时空切片求值器。
- `src/react/`：`EditorProvider`、`EditorContext`、基于 `useSyncExternalStore` 的精确订阅选择器与 React Hooks。
- `src/panels/`：可解耦挂载与二次装配的 11 类标准独立面板：
  - `TimelinePanel`：支持 Full 专业多轨与 Compact 精简/IP 两种变体形态的时间轴；
  - `InspectorPanel`：空间尺寸、比例锁、旋转、圆角、蒙版与业务构图预设大卡；
  - `CaptionsPanel`：单句校时、正文编辑、拆合平移、预设样式一键应用与 SRT 往返无损导入导出；
  - `TextPanel`：文本图层字体、字号、字重、颜色、描边与排版溢出检查；
  - `TemplatePanel`：4 套确定性场景预设（竖屏口播 9:16、知识科普 16:9、爆款快闪 9:16、好物开箱 1:1）与封面编辑；
  - `MediaPanel`：素材分类筛选、本地素材导入与一键上轨；
  - `TransitionsPanel`：转场预设库（硬切、淡入淡出、叠化、方向擦除）与相邻双选套用；
  - `EffectsPanel`：亮度、对比度、饱和度、灰度、模糊滤镜调节与重置；
  - `KeyframesPanel`：多属性通道选择、贝塞尔/线性曲线与播放头打帧；
  - `AudioMixerPanel`：多轨推子、Solo/Mute 独奏与软限幅母带总线监控；
  - `ExportPanel`：静态预检报告、1080P/720P 规格选择、渲染进度与 MP4 Blob 导出；
  - `PlayerSurface`：Canvas 2D 实时合成监视器。
- `src/styles/`：组件基础样式与深色主题变量。

## 模块子路径导出

```json
{
  "@no996/video-editor": "统一入口",
  "@no996/video-editor/core": "纯核心领域能力（零 React）",
  "@no996/video-editor/react": "React Provider 与 Hooks",
  "@no996/video-editor/panels": "独立面板集合",
  "@no996/video-editor/styles.css": "基础剪辑台暗色主题样式"
}
```

## 快速使用

```tsx
import React, { useState } from 'react'
import {
  EditorProvider,
  createEmptyDocument,
  DEFAULT_FULL_PROFILE,
  PlayerSurface,
  TimelinePanel,
  InspectorPanel,
  usePlayback,
  useEditorInstance,
  type EditorDocument,
} from '@no996/video-editor'
import '@no996/video-editor/styles.css'

export function App() {
  const [doc, setDoc] = useState(() => createEmptyDocument('proj-1', '我的剪辑作品', 'user-001', '16:9'))

  return (
    <EditorProvider document={doc} profile={DEFAULT_FULL_PROFILE} onDocumentChange={setDoc}>
      <EditorView />
    </EditorProvider>
  )
}

function EditorView() {
  const editor = useEditorInstance()
  const { playheadUs, isPlaying, togglePlay, seek } = usePlayback()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, display: 'flex' }}>
        <PlayerSurface
          editor={editor}
          playheadUs={playheadUs}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onSeek={seek}
        />
        <InspectorPanel editor={editor} style={{ width: 300 }} />
      </div>
      <div style={{ height: 260 }}>
        <TimelinePanel editor={editor} playheadUs={playheadUs} onSeek={seek} />
      </div>
    </div>
  )
}
```

## 质量门禁与断言守卫

1. **零单例架构**：各 `EditorInstance` 彻底独立，支持同屏多开且互不串号；
2. **隐藏不丢数据**：通过 `PanelProfile` 白名单隐藏的专业面板（如滤镜或关键帧），底层工程数据完好保留且正常参与画面合成；
3. **命令禁用防绕过**：通过 `CommandPolicy` 禁用的命令在底层拦截，无论 UI 或快捷键均无法绕过；
4. **整数微秒精度**：所有时间戳统一采用整数 `timeUs`，杜绝浮点累积误差与负时间；
5. **软限幅防破音**：混音采用 `softClipLimiter` 将多轨叠加采样平滑限制在 `[-1.0, 1.0]`，避免数字失真。
