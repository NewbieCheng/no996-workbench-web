/**
 * 音效与 BGM 清单 —— 由 scripts/generate-audio-manifest.mjs 生成，禁止手改。
 * 共 149 个音效（16 类）、5 首 BGM。
 * 资源位于 packages/video-editor/public/，按需 fetch，不进主包。
 */

export type SfxDefinition = {
  id: string
  category: string
  categoryLabel: string
  label: string
  /** 相对 public 根的路径 */
  path: string
  bytes: number
}

export type BgmDefinition = {
  id: string
  label: string
  path: string
  bytes: number
}

export const SFX_CATALOG: readonly SfxDefinition[] = [
  {
    "id": "camera/camera-autofocus",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "camera-autofocus",
    "path": "sfx/camera/camera-autofocus.mp3",
    "bytes": 313998
  },
  {
    "id": "camera/camera-lens-shutter",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "camera-lens-shutter",
    "path": "sfx/camera/camera-lens-shutter.mp3",
    "bytes": 47132
  },
  {
    "id": "camera/camera-shutter-hard",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "camera-shutter-hard",
    "path": "sfx/camera/camera-shutter-hard.mp3",
    "bytes": 18370
  },
  {
    "id": "camera/camera-shutter-vintage",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "camera-shutter-vintage",
    "path": "sfx/camera/camera-shutter-vintage.mp3",
    "bytes": 30533
  },
  {
    "id": "camera/click-camera",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "click-camera",
    "path": "sfx/camera/click-camera.mp3",
    "bytes": 14406
  },
  {
    "id": "camera/ui-zoom-in",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "ui-zoom-in",
    "path": "sfx/camera/ui-zoom-in.mp3",
    "bytes": 19624
  },
  {
    "id": "camera/ui-zoom-out",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "ui-zoom-out",
    "path": "sfx/camera/ui-zoom-out.mp3",
    "bytes": 34864
  },
  {
    "id": "camera/zoom-air-fast",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "zoom-air-fast",
    "path": "sfx/camera/zoom-air-fast.mp3",
    "bytes": 42071
  },
  {
    "id": "camera/zoom-futuristic",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "zoom-futuristic",
    "path": "sfx/camera/zoom-futuristic.mp3",
    "bytes": 69422
  },
  {
    "id": "camera/zoom-swipe-fast",
    "category": "camera",
    "categoryLabel": "镜头",
    "label": "zoom-swipe-fast",
    "path": "sfx/camera/zoom-swipe-fast.mp3",
    "bytes": 35650
  },
  {
    "id": "counter/clock-knob-spin",
    "category": "counter",
    "categoryLabel": "计数",
    "label": "clock-knob-spin",
    "path": "sfx/counter/clock-knob-spin.mp3",
    "bytes": 16437
  },
  {
    "id": "counter/clock-mech-retract",
    "category": "counter",
    "categoryLabel": "计数",
    "label": "clock-mech-retract",
    "path": "sfx/counter/clock-mech-retract.mp3",
    "bytes": 45670
  },
  {
    "id": "counter/clock-tick-single",
    "category": "counter",
    "categoryLabel": "计数",
    "label": "clock-tick-single",
    "path": "sfx/counter/clock-tick-single.mp3",
    "bytes": 20508
  },
  {
    "id": "counter/countdown-bleeps",
    "category": "counter",
    "categoryLabel": "计数",
    "label": "countdown-bleeps",
    "path": "sfx/counter/countdown-bleeps.mp3",
    "bytes": 37984
  },
  {
    "id": "crowd/applause-rhythmic-loop",
    "category": "crowd",
    "categoryLabel": "人群",
    "label": "applause-rhythmic-loop",
    "path": "sfx/crowd/applause-rhythmic-loop.mp3",
    "bytes": 166404
  },
  {
    "id": "crowd/clap-single",
    "category": "crowd",
    "categoryLabel": "人群",
    "label": "clap-single",
    "path": "sfx/crowd/clap-single.mp3",
    "bytes": 3546
  },
  {
    "id": "crowd/heartbeat-single",
    "category": "crowd",
    "categoryLabel": "人群",
    "label": "heartbeat-single",
    "path": "sfx/crowd/heartbeat-single.mp3",
    "bytes": 36640
  },
  {
    "id": "data/break-glitch-digital",
    "category": "data",
    "categoryLabel": "数据",
    "label": "break-glitch-digital",
    "path": "sfx/data/break-glitch-digital.mp3",
    "bytes": 38314
  },
  {
    "id": "data/data-compute",
    "category": "data",
    "categoryLabel": "数据",
    "label": "data-compute",
    "path": "sfx/data/data-compute.mp3",
    "bytes": 111072
  },
  {
    "id": "data/data-load-os",
    "category": "data",
    "categoryLabel": "数据",
    "label": "data-load-os",
    "path": "sfx/data/data-load-os.mp3",
    "bytes": 87792
  },
  {
    "id": "data/data-scan",
    "category": "data",
    "categoryLabel": "数据",
    "label": "data-scan",
    "path": "sfx/data/data-scan.mp3",
    "bytes": 71567
  },
  {
    "id": "data/glitch-electric-small",
    "category": "data",
    "categoryLabel": "数据",
    "label": "glitch-electric-small",
    "path": "sfx/data/glitch-electric-small.mp3",
    "bytes": 36538
  },
  {
    "id": "data/glitch-static-electric",
    "category": "data",
    "categoryLabel": "数据",
    "label": "glitch-static-electric",
    "path": "sfx/data/glitch-static-electric.mp3",
    "bytes": 52196
  },
  {
    "id": "data/glitch-static",
    "category": "data",
    "categoryLabel": "数据",
    "label": "glitch-static",
    "path": "sfx/data/glitch-static.mp3",
    "bytes": 48177
  },
  {
    "id": "data/glitch-virtual-quick",
    "category": "data",
    "categoryLabel": "数据",
    "label": "glitch-virtual-quick",
    "path": "sfx/data/glitch-virtual-quick.mp3",
    "bytes": 66497
  },
  {
    "id": "data/power-up-electronic",
    "category": "data",
    "categoryLabel": "数据",
    "label": "power-up-electronic",
    "path": "sfx/data/power-up-electronic.mp3",
    "bytes": 153553
  },
  {
    "id": "data/power-up-static",
    "category": "data",
    "categoryLabel": "数据",
    "label": "power-up-static",
    "path": "sfx/data/power-up-static.mp3",
    "bytes": 99854
  },
  {
    "id": "data/static-electric-present",
    "category": "data",
    "categoryLabel": "数据",
    "label": "static-electric-present",
    "path": "sfx/data/static-electric-present.mp3",
    "bytes": 128770
  },
  {
    "id": "data/sweep-digital",
    "category": "data",
    "categoryLabel": "数据",
    "label": "sweep-digital",
    "path": "sfx/data/sweep-digital.mp3",
    "bytes": 38311
  },
  {
    "id": "data/whoosh-electric",
    "category": "data",
    "categoryLabel": "数据",
    "label": "whoosh-electric",
    "path": "sfx/data/whoosh-electric.mp3",
    "bytes": 72010
  },
  {
    "id": "film/cassette-stretch",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "cassette-stretch",
    "path": "sfx/film/cassette-stretch.mp3",
    "bytes": 71499
  },
  {
    "id": "film/cassette-working",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "cassette-working",
    "path": "sfx/film/cassette-working.mp3",
    "bytes": 65907
  },
  {
    "id": "film/projector-spin-antique",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "projector-spin-antique",
    "path": "sfx/film/projector-spin-antique.mp3",
    "bytes": 761771
  },
  {
    "id": "film/reel-rewind",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "reel-rewind",
    "path": "sfx/film/reel-rewind.mp3",
    "bytes": 123593
  },
  {
    "id": "film/tape-rewind-cine",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "tape-rewind-cine",
    "path": "sfx/film/tape-rewind-cine.mp3",
    "bytes": 135704
  },
  {
    "id": "film/tape-rewind-fast",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "tape-rewind-fast",
    "path": "sfx/film/tape-rewind-fast.mp3",
    "bytes": 58975
  },
  {
    "id": "film/vinyl-needle-drop",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "vinyl-needle-drop",
    "path": "sfx/film/vinyl-needle-drop.mp3",
    "bytes": 12292
  },
  {
    "id": "film/vinyl-scratch-small",
    "category": "film",
    "categoryLabel": "胶片",
    "label": "vinyl-scratch-small",
    "path": "sfx/film/vinyl-scratch-small.mp3",
    "bytes": 37797
  },
  {
    "id": "fluid/liquid-bubble",
    "category": "fluid",
    "categoryLabel": "流体",
    "label": "liquid-bubble",
    "path": "sfx/fluid/liquid-bubble.mp3",
    "bytes": 36328
  },
  {
    "id": "fluid/sand-swish",
    "category": "fluid",
    "categoryLabel": "流体",
    "label": "sand-swish",
    "path": "sfx/fluid/sand-swish.mp3",
    "bytes": 62840
  },
  {
    "id": "fluid/water-bubble",
    "category": "fluid",
    "categoryLabel": "流体",
    "label": "water-bubble",
    "path": "sfx/fluid/water-bubble.mp3",
    "bytes": 12941
  },
  {
    "id": "fluid/water-drop-cave",
    "category": "fluid",
    "categoryLabel": "流体",
    "label": "water-drop-cave",
    "path": "sfx/fluid/water-drop-cave.mp3",
    "bytes": 62144
  },
  {
    "id": "fluid/water-splash",
    "category": "fluid",
    "categoryLabel": "流体",
    "label": "water-splash",
    "path": "sfx/fluid/water-splash.mp3",
    "bytes": 52302
  },
  {
    "id": "glass/glass-break-hammer",
    "category": "glass",
    "categoryLabel": "玻璃",
    "label": "glass-break-hammer",
    "path": "sfx/glass/glass-break-hammer.mp3",
    "bytes": 36584
  },
  {
    "id": "glass/glass-debris-sweep",
    "category": "glass",
    "categoryLabel": "玻璃",
    "label": "glass-debris-sweep",
    "path": "sfx/glass/glass-debris-sweep.mp3",
    "bytes": 80791
  },
  {
    "id": "glass/glass-hit-cine",
    "category": "glass",
    "categoryLabel": "玻璃",
    "label": "glass-hit-cine",
    "path": "sfx/glass/glass-hit-cine.mp3",
    "bytes": 145460
  },
  {
    "id": "glass/glass-plate-slide",
    "category": "glass",
    "categoryLabel": "玻璃",
    "label": "glass-plate-slide",
    "path": "sfx/glass/glass-plate-slide.mp3",
    "bytes": 29486
  },
  {
    "id": "impact/bass-hit-futuristic",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "bass-hit-futuristic",
    "path": "sfx/impact/bass-hit-futuristic.mp3",
    "bytes": 73486
  },
  {
    "id": "impact/bass-hit-short",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "bass-hit-short",
    "path": "sfx/impact/bass-hit-short.mp3",
    "bytes": 36222
  },
  {
    "id": "impact/gravel-fall-hit",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "gravel-fall-hit",
    "path": "sfx/impact/gravel-fall-hit.mp3",
    "bytes": 43846
  },
  {
    "id": "impact/hit-blow",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "hit-blow",
    "path": "sfx/impact/hit-blow.mp3",
    "bytes": 16962
  },
  {
    "id": "impact/hit-fast-exciting",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "hit-fast-exciting",
    "path": "sfx/impact/hit-fast-exciting.mp3",
    "bytes": 58464
  },
  {
    "id": "impact/hit-weak",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "hit-weak",
    "path": "sfx/impact/hit-weak.mp3",
    "bytes": 12834
  },
  {
    "id": "impact/impact-cine-big",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "impact-cine-big",
    "path": "sfx/impact/impact-cine-big.mp3",
    "bytes": 225505
  },
  {
    "id": "impact/impact-deep-whoosh",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "impact-deep-whoosh",
    "path": "sfx/impact/impact-deep-whoosh.mp3",
    "bytes": 115904
  },
  {
    "id": "impact/impact-epic-trailer",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "impact-epic-trailer",
    "path": "sfx/impact/impact-epic-trailer.mp3",
    "bytes": 154441
  },
  {
    "id": "impact/impact-movie-epic",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "impact-movie-epic",
    "path": "sfx/impact/impact-movie-epic.mp3",
    "bytes": 161076
  },
  {
    "id": "impact/impact-transition",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "impact-transition",
    "path": "sfx/impact/impact-transition.mp3",
    "bytes": 154441
  },
  {
    "id": "impact/impact-zoom-quick",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "impact-zoom-quick",
    "path": "sfx/impact/impact-zoom-quick.mp3",
    "bytes": 39932
  },
  {
    "id": "impact/metal-spring-hit",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "metal-spring-hit",
    "path": "sfx/impact/metal-spring-hit.mp3",
    "bytes": 62622
  },
  {
    "id": "impact/stomp-apocalyptic",
    "category": "impact",
    "categoryLabel": "冲击",
    "label": "stomp-apocalyptic",
    "path": "sfx/impact/stomp-apocalyptic.mp3",
    "bytes": 91755
  },
  {
    "id": "light/light-aura",
    "category": "light",
    "categoryLabel": "光效",
    "label": "light-aura",
    "path": "sfx/light/light-aura.mp3",
    "bytes": 174534
  },
  {
    "id": "light/light-spell",
    "category": "light",
    "categoryLabel": "光效",
    "label": "light-spell",
    "path": "sfx/light/light-spell.mp3",
    "bytes": 219196
  },
  {
    "id": "light/light-sweep-magic",
    "category": "light",
    "categoryLabel": "光效",
    "label": "light-sweep-magic",
    "path": "sfx/light/light-sweep-magic.mp3",
    "bytes": 150006
  },
  {
    "id": "light/light-transition-magic",
    "category": "light",
    "categoryLabel": "光效",
    "label": "light-transition-magic",
    "path": "sfx/light/light-transition-magic.mp3",
    "bytes": 158830
  },
  {
    "id": "light/shimmer-sparkle-sweep",
    "category": "light",
    "categoryLabel": "光效",
    "label": "shimmer-sparkle-sweep",
    "path": "sfx/light/shimmer-sparkle-sweep.mp3",
    "bytes": 94788
  },
  {
    "id": "light/sparkle-poof-hit",
    "category": "light",
    "categoryLabel": "光效",
    "label": "sparkle-poof-hit",
    "path": "sfx/light/sparkle-poof-hit.mp3",
    "bytes": 83919
  },
  {
    "id": "light/sparkle-touch",
    "category": "light",
    "categoryLabel": "光效",
    "label": "sparkle-touch",
    "path": "sfx/light/sparkle-touch.mp3",
    "bytes": 73387
  },
  {
    "id": "light/sparkle-wand",
    "category": "light",
    "categoryLabel": "光效",
    "label": "sparkle-wand",
    "path": "sfx/light/sparkle-wand.mp3",
    "bytes": 77103
  },
  {
    "id": "light/sparkle",
    "category": "light",
    "categoryLabel": "光效",
    "label": "sparkle",
    "path": "sfx/light/sparkle.mp3",
    "bytes": 143743
  },
  {
    "id": "light/stardust-swish",
    "category": "light",
    "categoryLabel": "光效",
    "label": "stardust-swish",
    "path": "sfx/light/stardust-swish.mp3",
    "bytes": 150845
  },
  {
    "id": "mech/door-open-futuristic",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "door-open-futuristic",
    "path": "sfx/mech/door-open-futuristic.mp3",
    "bytes": 34927
  },
  {
    "id": "mech/gear-lock-metallic",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "gear-lock-metallic",
    "path": "sfx/mech/gear-lock-metallic.mp3",
    "bytes": 35603
  },
  {
    "id": "mech/lock-digital",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "lock-digital",
    "path": "sfx/mech/lock-digital.mp3",
    "bytes": 34035
  },
  {
    "id": "mech/lock-quick",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "lock-quick",
    "path": "sfx/mech/lock-quick.mp3",
    "bytes": 37894
  },
  {
    "id": "mech/machine-activate-short",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "machine-activate-short",
    "path": "sfx/mech/machine-activate-short.mp3",
    "bytes": 77611
  },
  {
    "id": "mech/mech-robotic-futuristic",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "mech-robotic-futuristic",
    "path": "sfx/mech/mech-robotic-futuristic.mp3",
    "bytes": 301687
  },
  {
    "id": "mech/mech-tech-movement",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "mech-tech-movement",
    "path": "sfx/mech/mech-tech-movement.mp3",
    "bytes": 73906
  },
  {
    "id": "mech/metal-drop-scifi-small",
    "category": "mech",
    "categoryLabel": "机械",
    "label": "metal-drop-scifi-small",
    "path": "sfx/mech/metal-drop-scifi-small.mp3",
    "bytes": 45707
  },
  {
    "id": "paper/paper-book-browse-fast",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-book-browse-fast",
    "path": "sfx/paper/paper-book-browse-fast.mp3",
    "bytes": 306286
  },
  {
    "id": "paper/paper-crumple-quick",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-crumple-quick",
    "path": "sfx/paper/paper-crumple-quick.mp3",
    "bytes": 42178
  },
  {
    "id": "paper/paper-move-quick",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-move-quick",
    "path": "sfx/paper/paper-move-quick.mp3",
    "bytes": 31682
  },
  {
    "id": "paper/paper-page-turn-big",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-page-turn-big",
    "path": "sfx/paper/paper-page-turn-big.mp3",
    "bytes": 30379
  },
  {
    "id": "paper/paper-page-turn",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-page-turn",
    "path": "sfx/paper/paper-page-turn.mp3",
    "bytes": 18060
  },
  {
    "id": "paper/paper-scissors-cut",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-scissors-cut",
    "path": "sfx/paper/paper-scissors-cut.mp3",
    "bytes": 60324
  },
  {
    "id": "paper/paper-slice-quick",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-slice-quick",
    "path": "sfx/paper/paper-slice-quick.mp3",
    "bytes": 13962
  },
  {
    "id": "paper/paper-slide",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-slide",
    "path": "sfx/paper/paper-slide.mp3",
    "bytes": 37161
  },
  {
    "id": "paper/paper-staple",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-staple",
    "path": "sfx/paper/paper-staple.mp3",
    "bytes": 10006
  },
  {
    "id": "paper/paper-wind-blow",
    "category": "paper",
    "categoryLabel": "纸张",
    "label": "paper-wind-blow",
    "path": "sfx/paper/paper-wind-blow.mp3",
    "bytes": 171205
  },
  {
    "id": "riser/riser-cine",
    "category": "riser",
    "categoryLabel": "升起",
    "label": "riser-cine",
    "path": "sfx/riser/riser-cine.mp3",
    "bytes": 145112
  },
  {
    "id": "scifi/hitech-bleep",
    "category": "scifi",
    "categoryLabel": "科幻",
    "label": "hitech-bleep",
    "path": "sfx/scifi/hitech-bleep.mp3",
    "bytes": 20876
  },
  {
    "id": "scifi/scifi-click",
    "category": "scifi",
    "categoryLabel": "科幻",
    "label": "scifi-click",
    "path": "sfx/scifi/scifi-click.mp3",
    "bytes": 20354
  },
  {
    "id": "scifi/scifi-computer-ambience",
    "category": "scifi",
    "categoryLabel": "科幻",
    "label": "scifi-computer-ambience",
    "path": "sfx/scifi/scifi-computer-ambience.mp3",
    "bytes": 776699
  },
  {
    "id": "scifi/space-intro-futuristic",
    "category": "scifi",
    "categoryLabel": "科幻",
    "label": "space-intro-futuristic",
    "path": "sfx/scifi/space-intro-futuristic.mp3",
    "bytes": 217447
  },
  {
    "id": "scifi/tech-hum-futuristic",
    "category": "scifi",
    "categoryLabel": "科幻",
    "label": "tech-hum-futuristic",
    "path": "sfx/scifi/tech-hum-futuristic.mp3",
    "bytes": 156614
  },
  {
    "id": "text/chalk-line",
    "category": "text",
    "categoryLabel": "文字",
    "label": "chalk-line",
    "path": "sfx/text/chalk-line.mp3",
    "bytes": 36013
  },
  {
    "id": "text/keyboard",
    "category": "text",
    "categoryLabel": "文字",
    "label": "keyboard",
    "path": "sfx/text/keyboard.mp3",
    "bytes": 513831
  },
  {
    "id": "text/marker-pen-line",
    "category": "text",
    "categoryLabel": "文字",
    "label": "marker-pen-line",
    "path": "sfx/text/marker-pen-line.mp3",
    "bytes": 39045
  },
  {
    "id": "text/pen-click-twice",
    "category": "text",
    "categoryLabel": "文字",
    "label": "pen-click-twice",
    "path": "sfx/text/pen-click-twice.mp3",
    "bytes": 20965
  },
  {
    "id": "text/pen-write-paper",
    "category": "text",
    "categoryLabel": "文字",
    "label": "pen-write-paper",
    "path": "sfx/text/pen-write-paper.mp3",
    "bytes": 46147
  },
  {
    "id": "text/pencil-write-short",
    "category": "text",
    "categoryLabel": "文字",
    "label": "pencil-write-short",
    "path": "sfx/text/pencil-write-short.mp3",
    "bytes": 25257
  },
  {
    "id": "text/typewriter-digital",
    "category": "text",
    "categoryLabel": "文字",
    "label": "typewriter-digital",
    "path": "sfx/text/typewriter-digital.mp3",
    "bytes": 65353
  },
  {
    "id": "text/typewriter-hit-hard",
    "category": "text",
    "categoryLabel": "文字",
    "label": "typewriter-hit-hard",
    "path": "sfx/text/typewriter-hit-hard.mp3",
    "bytes": 34769
  },
  {
    "id": "text/typewriter-hit-single",
    "category": "text",
    "categoryLabel": "文字",
    "label": "typewriter-hit-single",
    "path": "sfx/text/typewriter-hit-single.mp3",
    "bytes": 21398
  },
  {
    "id": "text/typewriter-hit-soft",
    "category": "text",
    "categoryLabel": "文字",
    "label": "typewriter-hit-soft",
    "path": "sfx/text/typewriter-hit-soft.mp3",
    "bytes": 15396
  },
  {
    "id": "text/typewriter-return-bell",
    "category": "text",
    "categoryLabel": "文字",
    "label": "typewriter-return-bell",
    "path": "sfx/text/typewriter-return-bell.mp3",
    "bytes": 56060
  },
  {
    "id": "text/write-blackboard",
    "category": "text",
    "categoryLabel": "文字",
    "label": "write-blackboard",
    "path": "sfx/text/write-blackboard.mp3",
    "bytes": 444912
  },
  {
    "id": "text/write-fast",
    "category": "text",
    "categoryLabel": "文字",
    "label": "write-fast",
    "path": "sfx/text/write-fast.mp3",
    "bytes": 21606
  },
  {
    "id": "transition/air-whoosh-powerful",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "air-whoosh-powerful",
    "path": "sfx/transition/air-whoosh-powerful.mp3",
    "bytes": 58983
  },
  {
    "id": "transition/air-woosh-deep",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "air-woosh-deep",
    "path": "sfx/transition/air-woosh-deep.mp3",
    "bytes": 92185
  },
  {
    "id": "transition/air-woosh-quick",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "air-woosh-quick",
    "path": "sfx/transition/air-woosh-quick.mp3",
    "bytes": 48543
  },
  {
    "id": "transition/air-zoom-vacuum",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "air-zoom-vacuum",
    "path": "sfx/transition/air-zoom-vacuum.mp3",
    "bytes": 41082
  },
  {
    "id": "transition/sweep-fast-small",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "sweep-fast-small",
    "path": "sfx/transition/sweep-fast-small.mp3",
    "bytes": 27247
  },
  {
    "id": "transition/sweep-fast",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "sweep-fast",
    "path": "sfx/transition/sweep-fast.mp3",
    "bytes": 61800
  },
  {
    "id": "transition/sweep-metal-quick",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "sweep-metal-quick",
    "path": "sfx/transition/sweep-metal-quick.mp3",
    "bytes": 51881
  },
  {
    "id": "transition/sweep-scifi-fast",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "sweep-scifi-fast",
    "path": "sfx/transition/sweep-scifi-fast.mp3",
    "bytes": 28596
  },
  {
    "id": "transition/sweep-short",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "sweep-short",
    "path": "sfx/transition/sweep-short.mp3",
    "bytes": 18057
  },
  {
    "id": "transition/swoosh-quick",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "swoosh-quick",
    "path": "sfx/transition/swoosh-quick.mp3",
    "bytes": 27247
  },
  {
    "id": "transition/swoosh-slow",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "swoosh-slow",
    "path": "sfx/transition/swoosh-slow.mp3",
    "bytes": 168187
  },
  {
    "id": "transition/transition-snap",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "transition-snap",
    "path": "sfx/transition/transition-snap.mp3",
    "bytes": 19051
  },
  {
    "id": "transition/transition-soft",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "transition-soft",
    "path": "sfx/transition/transition-soft.mp3",
    "bytes": 41082
  },
  {
    "id": "transition/transition-tech-slide",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "transition-tech-slide",
    "path": "sfx/transition/transition-tech-slide.mp3",
    "bytes": 26239
  },
  {
    "id": "transition/transition-tech",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "transition-tech",
    "path": "sfx/transition/transition-tech.mp3",
    "bytes": 94273
  },
  {
    "id": "transition/warp-slide",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "warp-slide",
    "path": "sfx/transition/warp-slide.mp3",
    "bytes": 49839
  },
  {
    "id": "transition/whoosh-big",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "whoosh-big",
    "path": "sfx/transition/whoosh-big.mp3",
    "bytes": 71724
  },
  {
    "id": "transition/whoosh-fast",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "whoosh-fast",
    "path": "sfx/transition/whoosh-fast.mp3",
    "bytes": 57624
  },
  {
    "id": "transition/whoosh-swirl",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "whoosh-swirl",
    "path": "sfx/transition/whoosh-swirl.mp3",
    "bytes": 79754
  },
  {
    "id": "transition/wind-pass-vibrate",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "wind-pass-vibrate",
    "path": "sfx/transition/wind-pass-vibrate.mp3",
    "bytes": 183320
  },
  {
    "id": "transition/wind-swoosh-short",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "wind-swoosh-short",
    "path": "sfx/transition/wind-swoosh-short.mp3",
    "bytes": 44058
  },
  {
    "id": "transition/wind-woosh-throw",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "wind-woosh-throw",
    "path": "sfx/transition/wind-woosh-throw.mp3",
    "bytes": 28497
  },
  {
    "id": "transition/wing-flutter",
    "category": "transition",
    "categoryLabel": "转场",
    "label": "wing-flutter",
    "path": "sfx/transition/wing-flutter.mp3",
    "bytes": 133978
  },
  {
    "id": "ui/chime-crystal",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "chime-crystal",
    "path": "sfx/ui/chime-crystal.mp3",
    "bytes": 52451
  },
  {
    "id": "ui/hitech-touch-magnet",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "hitech-touch-magnet",
    "path": "sfx/ui/hitech-touch-magnet.mp3",
    "bytes": 55004
  },
  {
    "id": "ui/pop-electric",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "pop-electric",
    "path": "sfx/ui/pop-electric.mp3",
    "bytes": 37423
  },
  {
    "id": "ui/pop",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "pop",
    "path": "sfx/ui/pop.mp3",
    "bytes": 15239
  },
  {
    "id": "ui/switch-click-quick",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "switch-click-quick",
    "path": "sfx/ui/switch-click-quick.mp3",
    "bytes": 35439
  },
  {
    "id": "ui/switch-light",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "switch-light",
    "path": "sfx/ui/switch-light.mp3",
    "bytes": 6054
  },
  {
    "id": "ui/switch-tap",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "switch-tap",
    "path": "sfx/ui/switch-tap.mp3",
    "bytes": 35811
  },
  {
    "id": "ui/ui-click-tone",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-click-tone",
    "path": "sfx/ui/ui-click-tone.mp3",
    "bytes": 8455
  },
  {
    "id": "ui/ui-confirm-bleep",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-confirm-bleep",
    "path": "sfx/ui/ui-confirm-bleep.mp3",
    "bytes": 17953
  },
  {
    "id": "ui/ui-confirm-tone",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-confirm-tone",
    "path": "sfx/ui/ui-confirm-tone.mp3",
    "bytes": 43636
  },
  {
    "id": "ui/ui-message-pop",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-message-pop",
    "path": "sfx/ui/ui-message-pop.mp3",
    "bytes": 13059
  },
  {
    "id": "ui/ui-notify-tech",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-notify-tech",
    "path": "sfx/ui/ui-notify-tech.mp3",
    "bytes": 67229
  },
  {
    "id": "ui/ui-option-select",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-option-select",
    "path": "sfx/ui/ui-option-select.mp3",
    "bytes": 51255
  },
  {
    "id": "ui/ui-popup-dry",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-popup-dry",
    "path": "sfx/ui/ui-popup-dry.mp3",
    "bytes": 9706
  },
  {
    "id": "ui/ui-select-click",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-select-click",
    "path": "sfx/ui/ui-select-click.mp3",
    "bytes": 35602
  },
  {
    "id": "ui/ui-select-modern",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-select-modern",
    "path": "sfx/ui/ui-select-modern.mp3",
    "bytes": 4742
  },
  {
    "id": "ui/ui-success-soft",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-success-soft",
    "path": "sfx/ui/ui-success-soft.mp3",
    "bytes": 53759
  },
  {
    "id": "ui/ui-tone-quick",
    "category": "ui",
    "categoryLabel": "界面",
    "label": "ui-tone-quick",
    "path": "sfx/ui/ui-tone-quick.mp3",
    "bytes": 43375
  }
]

export const BGM_CATALOG: readonly BgmDefinition[] = [
  {
    "id": "bgm/bgm-tech-house",
    "label": "bgm-tech-house",
    "path": "bgm/bgm-tech-house.mp3",
    "bytes": 9240540
  },
  {
    "id": "bgm/cat-walk",
    "label": "cat-walk",
    "path": "bgm/cat-walk.mp3",
    "bytes": 3969820
  },
  {
    "id": "bgm/g-eazy-nba-type",
    "label": "g-eazy-nba-type",
    "path": "bgm/g-eazy-nba-type.mp3",
    "bytes": 3340373
  },
  {
    "id": "bgm/house-vibez",
    "label": "house-vibez",
    "path": "bgm/house-vibez.mp3",
    "bytes": 4458578
  },
  {
    "id": "bgm/tonight-hiphop",
    "label": "tonight-hiphop",
    "path": "bgm/tonight-hiphop.mp3",
    "bytes": 3631347
  }
]

export const SFX_COUNT = 149
export const BGM_COUNT = 5

export const SFX_CATEGORIES: readonly { id: string; label: string; count: number }[] =
  [
  {
    "id": "camera",
    "label": "镜头",
    "count": 10
  },
  {
    "id": "counter",
    "label": "计数",
    "count": 4
  },
  {
    "id": "crowd",
    "label": "人群",
    "count": 3
  },
  {
    "id": "data",
    "label": "数据",
    "count": 13
  },
  {
    "id": "film",
    "label": "胶片",
    "count": 8
  },
  {
    "id": "fluid",
    "label": "流体",
    "count": 5
  },
  {
    "id": "glass",
    "label": "玻璃",
    "count": 4
  },
  {
    "id": "impact",
    "label": "冲击",
    "count": 14
  },
  {
    "id": "light",
    "label": "光效",
    "count": 10
  },
  {
    "id": "mech",
    "label": "机械",
    "count": 8
  },
  {
    "id": "paper",
    "label": "纸张",
    "count": 10
  },
  {
    "id": "riser",
    "label": "升起",
    "count": 1
  },
  {
    "id": "scifi",
    "label": "科幻",
    "count": 5
  },
  {
    "id": "text",
    "label": "文字",
    "count": 13
  },
  {
    "id": "transition",
    "label": "转场",
    "count": 23
  },
  {
    "id": "ui",
    "label": "界面",
    "count": 18
  }
]

export function findSfx(id: string): SfxDefinition | undefined {
  return SFX_CATALOG.find((item) => item.id === id)
}

/** 解析成浏览器可加载的 URL（配合 Vite 的 BASE_URL）。 */
export function audioAssetUrl(relativePath: string): string {
  const base =
    typeof import.meta !== 'undefined' && typeof import.meta.env?.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  // 音效与 BGM 作为公共包资源，由 video-editor 的 public 目录提供；
  // 宿主若未配置该目录，会 404 —— 此时面板会如实提示，不伪造播放。
  return `${prefix}video-editor/${relativePath.replace(/^\/+/, '')}`
}
