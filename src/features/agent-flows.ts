/**
 * Agent 流程统一登记处
 *
 * 各功能在 features/<name>/agent/stages.ts 里用 defineFlow 声明阶段。
 * 但「声明」依赖模块被 import 才生效 —— 如果某个页面以后不再直接引用自己的
 * stages 文件，该流程就会从注册表里静默消失。
 *
 * 这里集中 import 一次，保证 src/agent/registry 里的流程清单始终完整：
 *   - 应用启动时由 main.tsx 引入
 *   - 本机校验脚本可单独引入
 */
import './script-lab/agent/stages'
import './titles/agent/stages'
import './persona/agent/persona-flow'
import './social-studio/agent/stages'
import './social-studio/agent/topic-angles-stages'
import './social-studio/agent/wizard-outline-stages'
import './social-studio/rewrite/stages'
import './voice/agent/stages'
import './ip-video/agent/video-assembly-flow'
import './video-factory/agent/video-factory-director-flow'
import './moments/agent/stages'

export { listFlows, getFlow } from '../agent/registry'
