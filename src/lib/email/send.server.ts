/**
 * Server-side helper to render and enqueue an app email from cron/server code.
 * Mirrors the behavior of /lovable/email/transactional/send but callable without
 * a user JWT. Suitable for scheduled jobs (weekly digest, alerts).
 */
import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'bynku'
const SENDER_DOMAIN = 'notify.bynku.app'
const FROM_DOMAIN = 'bynku.app'

function tokenHex(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface EnqueueTemplateResult {
  ok: boolean
  reason?: 'suppressed' | 'no_template' | 'render_failed' | 'enqueue_failed'
  messageId?: string
}

/**
 * Render `templateName` with `templateData` and enqueue it for `recipientEmail`.
 * Silently succeeds when the recipient is suppressed (returns ok: false, reason).
 */
export async function enqueueTemplateEmail(input: {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, unknown>
  idempotencyKey?: string
}): Promise<EnqueueTemplateResult> {
  const { templateName, recipientEmail, templateData = {}, idempotencyKey } = input
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const entry = TEMPLATES[templateName]
  if (!entry) return { ok: false, reason: 'no_template' }

  const normalized = recipientEmail.trim().toLowerCase()

  // Suppression check
  const { data: sup } = await supabaseAdmin
    .from('suppressed_emails' as never)
    .select('email')
    .eq('email', normalized)
    .maybeSingle()
  if (sup) return { ok: false, reason: 'suppressed' }

  // Ensure an unsubscribe token exists
  let unsubscribeToken: string | null = null
  const { data: existing } = await supabaseAdmin
    .from('email_unsubscribe_tokens' as never)
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  const existingRow = existing as { token: string; used_at: string | null } | null
  if (existingRow?.token && !existingRow.used_at) {
    unsubscribeToken = existingRow.token
  } else if (!existingRow) {
    const fresh = tokenHex()
    await supabaseAdmin
      .from('email_unsubscribe_tokens' as never)
      .upsert(
        { email: normalized, token: fresh } as never,
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabaseAdmin
      .from('email_unsubscribe_tokens' as never)
      .select('token')
      .eq('email', normalized)
      .maybeSingle()
    unsubscribeToken = (stored as { token: string } | null)?.token ?? fresh
  }

  const messageId = crypto.randomUUID()
  let html: string
  let text: string
  try {
    const element = React.createElement(entry.component, templateData)
    html = await render(element)
    text = await render(element, { plainText: true })
  } catch (e) {
    console.error('template render failed', { templateName, e })
    return { ok: false, reason: 'render_failed' }
  }

  const subject =
    typeof entry.subject === 'function' ? entry.subject(templateData) : entry.subject

  // Log pending BEFORE enqueue
  await supabaseAdmin.from('email_send_log' as never).insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: normalized,
    status: 'pending',
  } as never)

  const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email' as never, {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: normalized,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey ?? messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  } as never)

  if (enqueueError) {
    console.error('enqueue failed', { templateName, enqueueError })
    await supabaseAdmin.from('email_send_log' as never).insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: normalized,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    } as never)
    return { ok: false, reason: 'enqueue_failed', messageId }
  }

  return { ok: true, messageId }
}
