'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'gvt_last_report'

interface LinkItem { id: number; label: string; url: string }

interface FormState {
  date: string
  hours: string
  completed: string
  pending: string
  nextActions: string
  blockers: string
  recommendation: string
  tomorrow: string
}

interface DeliveryState {
  clientName: string
  clientEmail: string
}

interface SavedReport {
  savedDate: string
  form: FormState
  delivery: DeliveryState
  mood: string
  links: LinkItem[]
}

interface ReviewResult {
  score: number
  verdict: string
  strengths: string[]
  improvements: string[]
  links_feedback: string
  followup_questions: string[]
  summary: string
}

interface SubmitResult {
  grading: ReviewResult
  emailPreview: { subject: string; previewText: string; html: string; plainText: string }
  emailMatchStatus: string
  sendStatus: string
}

const MOOD_OPTIONS = ['Excellent', 'Good', 'Challenging', 'Difficult']

const EMAIL_MATCH_LABELS: Record<string, { label: string; color: string }> = {
  match:                          { label: 'Email verified', color: '#0A505A' },
  flagged_typo:                   { label: 'Possible typo flagged', color: '#BA7517' },
  flagged_different_recipient:    { label: 'Different recipient flagged', color: '#993C1D' },
  flagged_new_domain:             { label: 'New domain flagged', color: '#993C1D' },
  no_trusted_email_on_file:       { label: 'No trusted email on file', color: '#555550' },
}

export default function EODRPage() {
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null)
  const [form, setForm] = useState<FormState>({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    completed: '',
    pending: '',
    nextActions: '',
    blockers: '',
    recommendation: '',
    tomorrow: '',
  })
  const [delivery, setDelivery] = useState<DeliveryState>({
    clientName: '',
    clientEmail: '',
  })
  const [mood, setMood] = useState('')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [linkCounter, setLinkCounter] = useState(0)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [savedReport, setSavedReport] = useState<SavedReport | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const reviewRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSavedReport(JSON.parse(raw))
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setDeliveryField(field: keyof DeliveryState, value: string | boolean) {
    setDelivery(prev => ({ ...prev, [field]: value }))
  }

  // Per spec: only pre-populate pending, nextActions, clientName, clientEmail
  function loadPrevious() {
    if (!savedReport) return
    setForm(prev => ({
      ...prev,
      pending: savedReport.form?.pending ?? '',
      nextActions: savedReport.form?.nextActions ?? '',
    }))
    setDelivery(prev => ({
      ...prev,
      clientName: savedReport.delivery?.clientName ?? '',
      clientEmail: savedReport.delivery?.clientEmail ?? '',
    }))
    setBannerDismissed(true)
  }

  function addLink() {
    const id = linkCounter + 1
    setLinkCounter(id)
    setLinks(prev => [...prev, { id, label: '', url: '' }])
  }
  function removeLink(id: number) { setLinks(prev => prev.filter(l => l.id !== id)) }
  function updateLink(id: number, field: 'label' | 'url', value: string) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const meter = useMemo(() => {
    const c = form.completed
    const checks = {
      tasks:     c.trim().length > 30,
      grouped:   /[A-Z][^\n]+:\s*\n/.test(c) || /\w+:\s*\n/.test(c) || c.includes(':\n'),
      outcomes:  /\d/.test(c) || /complet|finalise|publish|sent|updated|created|reconcil|built|configured|launched|submitted|drafted|scheduled|reviewed|uploaded/i.test(c),
      recommend: form.recommendation.trim().length > 40,
      deadlines: /deadline|target|by \w+day|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(form.nextActions),
      links:     links.length > 0,
      blockers:  form.blockers.trim().length > 5,
      tomorrow:  form.tomorrow.trim().length > 10,
    }
    const passed = Object.values(checks).filter(Boolean).length
    const score = Math.min(Math.round(passed * 1.25), 10)
    return { checks, score }
  }, [form, links])

  const meterColor = meter.score <= 3 ? '#E24B4A' : meter.score <= 6 ? '#EF9F27' : 'var(--gvt-teal)'
  const meterTextColor = meter.score <= 3 ? '#E24B4A' : meter.score <= 6 ? '#BA7517' : 'var(--gvt-teal)'

  async function submitReport() {
    if (!form.completed || !form.recommendation) {
      alert('Please fill in completed tasks and proactive recommendation before submitting.')
      return
    }
    if (!delivery.clientName || !delivery.clientEmail) {
      alert('Please fill in client name and client email in the Delivery Settings section.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery.clientEmail)) {
      alert('Please enter a valid client email address.')
      return
    }

    setLoading(true)
    setApiError(null)
    setSubmitResult(null)

    const snapshot: SavedReport = { savedDate: form.date, form, delivery, mood, links }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    setSavedReport(snapshot)

    setTimeout(() => {
      reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: { ...form, links },
          clientName: delivery.clientName,
          clientEmail: delivery.clientEmail,
          sendToCsm: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Submission failed')
      }
      const result: SubmitResult = await res.json()
      setSubmitResult(result)
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ date: new Date().toISOString().split('T')[0], hours: '', completed: '', pending: '', nextActions: '', blockers: '', recommendation: '', tomorrow: '' })
    setDelivery({ clientName: '', clientEmail: '' })
    setMood('')
    setLinks([])
    setSubmitResult(null)
    setApiError(null)
    setLoading(false)
    setShowEmailPreview(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showReviewPanel = loading || submitResult !== null || apiError

  return (
    <div id="app">

      {/* Header */}
      <div className="gvt-header">
        <div className="gvt-logo-mark">
          <img src="/logo.png" alt="GVT" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1>End of Day Report</h1>
          <p>Genesis Virtual Team — daily performance log</p>
        </div>
        {profile && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 500, color: '#fff' }}>{profile.full_name}</div>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 11, padding: 0, marginTop: 2 }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Previous Report Banner */}
      {savedReport && !bannerDismissed && submitResult === null && (
        <div style={{ background: '#fff', border: '0.5px solid var(--gvt-teal)', borderRadius: 'var(--radius-lg)', padding: '0.9rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-history" style={{ color: 'var(--gvt-teal)', fontSize: 18 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              You have a saved report from <strong>{savedReport.savedDate}</strong>. Pre-fills client, pending and next actions only.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadPrevious} style={{ background: 'var(--gvt-teal)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              Load last report
            </button>
            <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-tertiary)' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Best Practice Guide */}
      <div className="bp-panel">
        <h3><i className="ti ti-star" aria-hidden="true" /> Best practice guide</h3>
        <div className="bp-grid">
          {[
            { rule: 'Group completed tasks by project', eg: 'e.g. "GVT Website: Added staging site on WordPress..."' },
            { rule: 'Write outcomes, not just activities', eg: 'Good: "Reconciled 47 transactions in Xero" — Not: "Did Xero work"' },
            { rule: 'Include a specific proactive recommendation', eg: 'One concrete idea your client could act on — not generic advice' },
            { rule: 'Add target deadlines to next actions', eg: 'e.g. "Finalise GVT website — Target deadline: Wednesday, 23 April"' },
            { rule: 'Link every output with a descriptive label', eg: 'Good: "View GVT Content Calendar" + direct URL — Not: "Canva link"' },
          ].map((item, i) => (
            <div className="bp-row" key={i}>
              <div className="bp-num">{i + 1}</div>
              <div><div className="bp-rule">{item.rule}</div><div className="bp-eg">{item.eg}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Meter */}
      <div className="meter-wrap">
        <div className="meter-top">
          <div className="meter-label"><i className="ti ti-activity" aria-hidden="true" /> Report quality</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: meterTextColor, transition: 'color 0.3s' }}>
            {meter.score} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>/ 10</span>
          </div>
        </div>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${meter.score * 10}%`, background: meterColor }} />
        </div>
        <div className="meter-criteria">
          {[
            ['tasks', 'Tasks completed filled'], ['grouped', 'Grouped by project'],
            ['outcomes', 'Outcomes / specifics'], ['recommend', 'Proactive recommendation'],
            ['deadlines', 'Deadlines in next actions'], ['links', 'Links added'],
            ['blockers', 'Blockers addressed'], ['tomorrow', "Tomorrow's priority set"],
          ].map(([key, label]) => (
            <div key={key} className={`crit-item ${meter.checks[key as keyof typeof meter.checks] ? 'pass' : ''}`}>
              <div className="crit-dot" />{label}
            </div>
          ))}
        </div>
      </div>

      {/* Your Details */}
      <div className="card">
        <div className="section-label">your details</div>
        <div className="meta-row" style={{ marginBottom: '1rem' }}>
          <div className="field-group">
            <label><i className="ti ti-user" aria-hidden="true" /> Your name</label>
            <input type="text" value={profile?.full_name ?? ''} readOnly style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }} />
          </div>
          <div className="field-group">
            <label><i className="ti ti-calendar" aria-hidden="true" /> Date</label>
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <label><i className="ti ti-clock" aria-hidden="true" /> Hours logged today</label>
          <input type="number" value={form.hours} onChange={e => setField('hours', e.target.value)} min={0} max={12} step={0.5} placeholder="e.g. 8" style={{ maxWidth: 160 }} />
        </div>
      </div>

      {/* Tasks Completed */}
      <div className="card">
        <div className="section-label">tasks completed today</div>
        <div className="field-group">
          <label><i className="ti ti-check" aria-hidden="true" /> What did you complete today? <span className="req">*</span></label>
          <textarea rows={7} value={form.completed} onChange={e => setField('completed', e.target.value)}
            placeholder={"Group by project:\n\nGVT Website:\n• Added landing staging site on WordPress with revisions.\n• Updated the site icon to our new logo when viewed in browser.\n\nGVT May Content Calendar:\n• Created the GVT May editorial on Canva."} />
          <div className="hint">Group tasks by project. Outcomes and numbers make stronger reports.</div>
        </div>
      </div>

      {/* Pending & Next Actions */}
      <div className="card">
        <div className="section-label">pending and next actions</div>
        <div className="field-group">
          <label><i className="ti ti-hourglass" aria-hidden="true" /> In progress / pending</label>
          <textarea rows={3} value={form.pending} onChange={e => setField('pending', e.target.value)} placeholder="Tasks started but not yet finished, or waiting on someone else." />
        </div>
        <div className="divider" />
        <div className="field-group">
          <label><i className="ti ti-arrow-right" aria-hidden="true" /> Next actions — include target deadlines</label>
          <textarea rows={3} value={form.nextActions} onChange={e => setField('nextActions', e.target.value)}
            placeholder={"• Finalise GVT website on WordPress — Target deadline: Wednesday, 23 April\n• Begin May content generation — Target timeline: 23–25 April"} />
        </div>
      </div>

      {/* Risks & Blockers */}
      <div className="card">
        <div className="section-label">risks and roadblocks</div>
        <div className="field-group">
          <label><i className="ti ti-alert-triangle" aria-hidden="true" /> Risks / roadblocks / action needed from manager</label>
          <textarea rows={3} value={form.blockers} onChange={e => setField('blockers', e.target.value)} placeholder="Describe anything needing attention or sign-off. If none, write 'None at this time'." />
        </div>
      </div>

      {/* Proactive Thinking */}
      <div className="card">
        <div className="section-label">proactive thinking</div>
        <div className="field-group">
          <label><i className="ti ti-bulb" aria-hidden="true" /> One recommendation for your client&apos;s business or processes <span className="req">*</span></label>
          <textarea rows={4} value={form.recommendation} onChange={e => setField('recommendation', e.target.value)} placeholder="What did you observe today that could be done faster, smarter, or better? One specific, actionable idea." />
          <div className="hint">This shows strategic thinking — not just task completion.</div>
        </div>
      </div>

      {/* Links */}
      <div className="card">
        <div className="section-label">links to work outputs</div>
        <div className="field-group">
          <label><i className="ti ti-link" aria-hidden="true" /> Links to deliverables</label>
          {links.length > 0 && (
            <div className="link-col-labels">
              <span>Task / output name</span><span>URL</span><span />
            </div>
          )}
          <div className="links-block">
            {links.map(link => (
              <div className="link-row" key={link.id}>
                <input type="text" placeholder="View GVT Content Calendar" value={link.label} onChange={e => updateLink(link.id, 'label', e.target.value)} />
                <input type="url" placeholder="https://..." value={link.url} onChange={e => updateLink(link.id, 'url', e.target.value)} />
                <button className="link-remove" onClick={() => removeLink(link.id)} aria-label="Remove link">
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button className="add-link-btn" onClick={addLink}>
            <i className="ti ti-plus" aria-hidden="true" /> Add link
          </button>
        </div>
      </div>

      {/* EOD Reflection */}
      <div className="card">
        <div className="section-label">end of day reflection</div>
        <div className="field-group">
          <label><i className="ti ti-mood-smile" aria-hidden="true" /> How did today feel?</label>
          <div className="mood-row">
            {MOOD_OPTIONS.map(option => (
              <button key={option} className={`mood-btn ${mood === option ? 'selected' : ''}`} onClick={() => setMood(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="divider" />
        <div className="field-group">
          <label><i className="ti ti-target" aria-hidden="true" /> Priority for tomorrow</label>
          <textarea rows={2} value={form.tomorrow} onChange={e => setField('tomorrow', e.target.value)} placeholder="The one thing to get done first tomorrow." />
        </div>
      </div>

      {/* Delivery Settings */}
      <div className="card">
        <div className="section-label">delivery settings</div>
        <div className="meta-row" style={{ marginBottom: '1rem' }}>
          <div className="field-group">
            <label><i className="ti ti-building" aria-hidden="true" /> Client name <span className="req">*</span></label>
            <input type="text" value={delivery.clientName} onChange={e => setDeliveryField('clientName', e.target.value)} placeholder="e.g. Bright Accounting AU" />
          </div>
          <div className="field-group">
            <label><i className="ti ti-mail" aria-hidden="true" /> Client email <span className="req">*</span></label>
            <input type="email" value={delivery.clientEmail} onChange={e => setDeliveryField('clientEmail', e.target.value)} placeholder="client@example.com.au" />
          </div>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          Your report will be sent to your client and copied to your CSM automatically.
        </div>
      </div>

      <button className="submit-btn" onClick={submitReport} disabled={loading}>
        {loading
          ? <><i className="ti ti-loader" aria-hidden="true" /> Submitting — AI is reviewing and drafting your email...</>
          : <><i className="ti ti-send" aria-hidden="true" /> Submit and get AI review</>
        }
      </button>

      {/* Results Panel */}
      {showReviewPanel && (
        <div className="review-panel" ref={reviewRef}>
          <div className="review-header">
            <span><i className="ti ti-robot" aria-hidden="true" /> AI review</span>
            {submitResult && <span className="score-badge">{submitResult.grading.score}/10</span>}
          </div>
          <div className="review-body">
            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                Reviewing your report and drafting your client email — this takes about 15 seconds...
              </div>
            )}
            {apiError && (
              <div className="loading-state" style={{ color: '#993C1D' }}>
                <i className="ti ti-alert-circle" aria-hidden="true" /> Error: {apiError}
              </div>
            )}
            {submitResult && (
              <ReviewBody
                result={submitResult}
                showEmailPreview={showEmailPreview}
                onToggleEmail={() => setShowEmailPreview(p => !p)}
                onReset={resetForm}
              />
            )}
          </div>
        </div>
      )}

      <footer>Genesis Virtual Team &copy; 2025 &mdash; EODR System</footer>
    </div>
  )
}

function ReviewBody({ result, showEmailPreview, onToggleEmail, onReset }: {
  result: SubmitResult
  showEmailPreview: boolean
  onToggleEmail: () => void
  onReset: () => void
}) {
  const { grading, emailPreview, emailMatchStatus } = result
  const isGood = grading.score >= 7
  const matchInfo = EMAIL_MATCH_LABELS[emailMatchStatus] ?? { label: emailMatchStatus, color: '#555550' }

  return (
    <>
      <div className="review-section">
        <h3><i className="ti ti-report-analytics" aria-hidden="true" /> Overall</h3>
        <p style={{ marginBottom: 10 }}>
          <span className={`status-pill ${isGood ? 'pill-pass' : 'pill-needs'}`}>
            <i className={`ti ${isGood ? 'ti-circle-check' : 'ti-circle-x'}`} aria-hidden="true" />
            {grading.verdict}
          </span>
        </p>
        <p>{grading.summary}</p>
      </div>

      <div className="review-section">
        <h3><i className="ti ti-thumb-up" aria-hidden="true" /> What worked well</h3>
        <ul>{grading.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>

      <div className="review-section">
        <h3><i className="ti ti-pencil" aria-hidden="true" /> Ways to improve</h3>
        <ul>{grading.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>

      {grading.links_feedback && (
        <div className="review-section">
          <h3><i className="ti ti-link" aria-hidden="true" /> Links feedback</h3>
          <p>{grading.links_feedback}</p>
        </div>
      )}

      {grading.followup_questions?.length > 0 && (
        <div className="review-section">
          <h3><i className="ti ti-message-question" aria-hidden="true" /> Follow-up questions</h3>
          <div className="followup-list">
            {grading.followup_questions.map((q, i) => <div className="followup-q" key={i}>{q}</div>)}
          </div>
        </div>
      )}

      <div className="review-section">
        <h3><i className="ti ti-mail" aria-hidden="true" /> Client email</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{emailPreview.subject}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{emailPreview.previewText}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: matchInfo.color, padding: '3px 10px', borderRadius: 20, background: '#f5f5f0', flexShrink: 0 }}>
            {matchInfo.label}
          </span>
        </div>
        <button
          onClick={onToggleEmail}
          style={{ fontSize: 13, color: 'var(--gvt-teal)', background: 'var(--gvt-mint-bg)', border: '0.5px solid rgba(45,95,94,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className={`ti ${showEmailPreview ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
          {showEmailPreview ? 'Hide email preview' : 'Preview client email'}
        </button>
        {showEmailPreview && (
          <div style={{ marginTop: 12, border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <iframe
              srcDoc={emailPreview.html}
              style={{ width: '100%', height: 600, border: 'none' }}
              title="Email preview"
            />
          </div>
        )}
      </div>

      <button className="reset-btn" onClick={onReset}>
        <i className="ti ti-refresh" aria-hidden="true" /> Submit another report
      </button>
    </>
  )
}
