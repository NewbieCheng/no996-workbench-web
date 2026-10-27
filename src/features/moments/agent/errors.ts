import type { MomentsErrorCode } from '../domain/moments'

export class MomentsFlowError extends Error {
  readonly code: MomentsErrorCode
  readonly outcomeStatus: 'blocked' | 'failed'
  readonly details?: string[]
  readonly recoveryAction?: string

  constructor(input: {
    code: MomentsErrorCode
    message: string
    status?: 'blocked' | 'failed'
    details?: string[]
    recoveryAction?: string
  }) {
    super(input.message)
    this.name = 'MomentsFlowError'
    this.code = input.code
    this.outcomeStatus = input.status ?? (input.code === 'QC_FAILED' ? 'failed' : 'blocked')
    this.details = input.details
    this.recoveryAction = input.recoveryAction
  }
}

export function isMomentsFlowError(error: unknown): error is MomentsFlowError {
  return error instanceof MomentsFlowError
}
