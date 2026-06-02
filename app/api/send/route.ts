import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = 'reports@connect.netavirtualteam.com.au'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { submissionId } = await request.json()

    const { data: submission } = await supabase
      .from('eodr_submissions')
      .select('*, profiles(full_name, email)')
      .eq('id', submissionId)
      .eq('vp_user_id', user.id)
      .single()

    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    if (submission.send_status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

    const csmEmail = process.env.CSM_EMAIL ?? 'faith.e@netavirtualteam.com.au'
    const vpEmail = (submission.profiles as { email: string })?.email ?? ''

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: `GVT Reporting <${FROM_EMAIL}>`,
      to: [submission.client_email_entered],
      bcc: [csmEmail],
      replyTo: vpEmail,
      subject: submission.email_subject,
      html: submission.email_html,
      text: submission.email_plain_text,
    })

    if (sendError) throw new Error(sendError.message)

    await supabase.from('email_send_log').insert([
      { submission_id: submissionId, recipient_email: submission.client_email_entered, recipient_type: 'client', resend_message_id: sendData?.id, status: 'sent' },
      { submission_id: submissionId, recipient_email: csmEmail, recipient_type: 'csm_bcc', resend_message_id: sendData?.id, status: 'sent' },
    ])

    await supabase.from('eodr_submissions').update({ send_status: 'sent', sent_at: new Date().toISOString() }).eq('id', submissionId)

    return NextResponse.json({ success: true, messageId: sendData?.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Send error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
