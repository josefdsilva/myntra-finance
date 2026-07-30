import type { ComponentType } from 'react'
import { template as weeklyDigest } from './weekly-digest'
import { template as cycleStart } from './cycle-start'
import { template as handoffLedger } from './handoff-ledger'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'weekly-digest': weeklyDigest,
  'cycle-start': cycleStart,
  'handoff-ledger': handoffLedger,
}
