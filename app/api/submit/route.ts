import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GRADING_PROMPT, DELIVERY_PROMPT } from '@/lib/prompts'
import { buildEmailHtml, type EmailContent, type VPBadges } from '@/lib/email-template'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const MODEL = 'llama-3.1-8b-instant'

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0
  const unique = [...new Set(dates.map(d => d.split('T')[0]))].sort().reverse()
  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
  if (unique[0] !== today && unique[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]), curr = new Date(unique[i])
    if (Math.round((prev.getTime() - curr.getTime()) / 86400000) === 1) streak++
    else break
  }
  return streak
}

function parseJson(raw: string) {
  const cleaned = raw.replace(/```json|```/g, '').trim()

  // 1. Direct parse
  try { return JSON.parse(cleaned) } catch {}

  // 2. Fix literal newlines/tabs INSIDE quoted string values only
  try {
    const fixed = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, match =>
      match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    )
    return JSON.parse(fixed)
  } catch {}

  // 3. Strip all problematic control chars then retry
  try {
    const stripped = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    return JSON.parse(stripped)
  } catch {}

  // 4. Extract the outermost JSON object
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
    try {
      const fixed = match[0].replace(/"(?:[^"\\]|\\.)*"/g, m =>
        m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
      )
      return JSON.parse(fixed)
    } catch {}
  }

  throw new Error('Could not parse AI response as JSON')
}

function checkEmailMatch(entered: string, trusted: string): string {
  const e = entered.toLowerCase().trim()
  const t = trusted.toLowerCase().trim()
  if (e === t) return 'match'
  const eDomain = e.split('@')[1] ?? ''
  const tDomain = t.split('@')[1] ?? ''
  const eLocal = e.split('@')[0] ?? ''
  const tLocal = t.split('@')[0] ?? ''
  if (eDomain !== tDomain) return 'flagged_new_domain'
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

    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

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

    const gradingResponse = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: GRADING_PROMPT },
        { role: 'user', content: reportText },
      ],
    })

    const gradingRaw = gradingResponse.choices[0]?.message?.content ?? ''
    const grading = parseJson(gradingRaw)

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

    const emailResponse = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: DELIVERY_PROMPT },
        { role: 'user', content: deliveryInput },
      ],
    })

    const emailRaw = emailResponse.choices[0]?.message?.content ?? ''
    const emailContent: EmailContent = parseJson(emailRaw)

    // Calculate badges for email footer
    const { data: pastSubs } = await supabase
      .from('eodr_submissions')
      .select('created_at, ai_grade')
      .eq('vp_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const qualityCount = (pastSubs ?? []).filter(s => (s.ai_grade ?? 0) >= 8).length
    const streak = calcStreak((pastSubs ?? []).map(s => s.created_at))
    const badges: VPBadges = { streak, qualityCount }

    const emailHtml = buildEmailHtml(profile.full_name, submissionDate, emailContent, badges, grading.score)

    // ── Save submission ──────────────────────────────────────────────────────
    const csmEmail = process.env.CSM_EMAIL ?? 'faith.e@netavirtualteam.com.au'

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
        email_html: emailHtml,
        email_plain_text: emailContent.plain_text_body,
        send_to_csm: sendToCsm ?? true,
        send_status: 'pending_verification',
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
        html: emailHtml,
        plainText: emailContent.plain_text_body,
      },
      emailMatchStatus,
      csmEmail,
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
