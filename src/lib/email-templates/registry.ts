import type { ComponentType } from 'react'
import { template as companyDecisionTemplate } from './company-decision'
import { template as appNotificationTemplate } from './app-notification'
import { template as companySubscriptionReceiptTemplate } from './company-subscription-receipt'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'company-decision': companyDecisionTemplate,
  'app-notification': appNotificationTemplate,
  'company-subscription-receipt': companySubscriptionReceiptTemplate,
}
