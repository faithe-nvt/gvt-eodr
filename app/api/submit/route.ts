import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GRADING_PROMPT, DELIVERY_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic()

function checkEmailMatch(entered: string, trusted: string): string {
  const e = entered.toLowerCase().trim()
  const t = trusted.toLowerCase().trim()

  if (e === t) return 'match'

  const eDomain = e.split('@')[1] ?? ''
  const tDomain = t.split('@')[1] ?? ''
  const eLocal = e.split('@')[0] ?? ''
  const tLocal = t.split('@')[0] ?? ''

  if (eDomain !== tDomain) return 'flagged_new_domain'

  // Levenshtein distance on local part to detect typos
  const dist = levenshtein(eLocal, tLocal)
  if (dist <= 2) return 'flagged_typo'

  return 'flagged_different_recipient'
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const body = await request.json()
    const { formData, clientName, clientEmail, sendToCsm } = body

    // ── Trusted email check ──────────────────────────────────────────────────
    const { data: trusted } = await supabase
      .from('trusted_client_emails')
      .select('trusted_email')
      .eq('vp_user_id', user.id)
      .eq('client_name', clientName)
      .eq('is_active', true)
      .single()

    const trustedEmail = trusted?.trusted_email ?? null
    const emailMatchStatus = trustedEmail
      ? checkEmailMatch(clientEmail, trustedEmail)
      : 'no_trusted_email_on_file'

    // ── AI grading ───────────────────────────────────────────────────────────
    const reportText = buildReportText(profile.full_name, clientName, formData)

    const gradingMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: [{ type: 'text', text: GRADING_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: reportText }],
    })

    const gradingRaw = gradingMessage.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')

    const grading = JSON.parse(gradingRaw.replace(/```json|```/g, '').trim())

    // ── Email generation ─────────────────────────────────────────────────────
    const vpFirstName = profile.full_name.split(' ')[0]
    const submissionDate = new Date().toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const linksText = (formData.links ?? []).length > 0
      ? (formData.links as { label: string; url: string }[])
          .map(l => `${l.label}: ${l.url}`).join('\n')
      : 'None'

    const deliveryInput = `vp_full_name: ${profile.full_name}
vp_first_name: ${vpFirstName}
vp_email: ${profile.email}
client_first_name: ${clientName.split(' ')[0]}
submission_date: ${submissionDate}
tasks_completed: ${formData.completed ?? ''}
pending_and_next_actions: ${(formData.pending ?? '') + '\n' + (formData.nextActions ?? '')}
blockers: ${formData.blockers ?? ''}
recommendation: ${formData.recommendation ?? ''}
tomorrow_priority: ${formData.tomorrow ?? ''}
links: ${linksText}`

    const emailMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: [{ type: 'text', text: DELIVERY_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: deliveryInput }],
    })

    const emailRaw = emailMessage.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')

    const emailContent = JSON.parse(emailRaw.replace(/```json|```/g, '').trim())

    // ── Save submission ──────────────────────────────────────────────────────
    const sendStatus = emailMatchStatus === 'match' ? 'pending_verification' : 'pending_verification'

    const { data: submission, error: insertError } = await supabase
      .from('eodr_submissions')
      .insert({
        vp_user_id: user.id,
        client_name: clientName,
        client_email_entered: clientEmail,
        trusted_email_at_submission: trustedEmail,
        email_match_status: emailMatchStatus,
        form_data: formData,
        ai_grade: grading.score,
        ai_feedback: grading,
        email_subject: emailContent.subject,
        email_html: emailContent.html_body,
        email_plain_text: emailContent.plain_text_body,
        send_to_csm: sendToCsm ?? true,
        send_status: sendStatus,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      submissionId: submission.id,
      grading,
      emailPreview: {
        subject: emailContent.subject,
        previewText: emailContent.preview_text,
        html: emailContent.html_body,
        plainText: emailContent.plain_text_body,
      },
      emailMatchStatus,
      sendStatus,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Submit error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildReportText(vpName: string, clientName: string, f: Record<string, string>) {
  return `VP NAME: ${vpName}
CLIENT: ${clientName}
HOURS: ${f.hours ?? 'Not specified'}

COMPLETED TODAY:
${f.completed ?? ''}

IN PROGRESS / PENDING:
${f.pending ?? 'None stated'}

NEXT ACTIONS:
${f.nextActions ?? 'None stated'}

RISKS / ROADBLOCKS:
${f.blockers ?? 'None stated'}

PROACTIVE RECOMMENDATION:
${f.recommendation ?? ''}

TOMORROW: ${f.tomorrow ?? 'Not stated'}`
}
