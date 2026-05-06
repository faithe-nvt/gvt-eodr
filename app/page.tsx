'use client'

import { useState, useMemo, useRef } from 'react'

interface LinkItem {
  id: number
  label: string
  url: string
}

interface FormState {
  name: string
  date: string
  client: string
  hours: string
  completed: string
  pending: string
  nextActions: string
  blockers: string
  recommendation: string
  tomorrow: string
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

const MOOD_OPTIONS = ['Excellent', 'Good', 'Challenging', 'Difficult']

export default function EODRPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    client: '',
    hours: '',
    completed: '',
    pending: '',
    nextActions: '',
    blockers: '',
    recommendation: '',
    tomorrow: '',
  })
  const [mood, setMood] = useState('')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [linkCounter, setLinkCounter] = useState(0)
  const [review, setReview] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addLink() {
    const id = linkCounter + 1
    setLinkCounter(id)
    setLinks(prev => [...prev, { id, label: '', url: '' }])
  }

  function removeLink(id: number) {
    setLinks(prev => prev.filter(l => l.id !== id))
  }

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
    if (!form.name || !form.completed || !form.recommendation) {
      alert('Please fill in your name, completed tasks, and proactive recommendation before submitting.')
      return
    }

    setLoading(true)
    setApiError(null)
    setReview(null)

    setTimeout(() => {
      reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)

    const linksText = links.length
      ? links.map(l => `• ${l.label || '(no label)'}: ${l.url || '(no URL)'}`).join('\n')
      : 'None provided'

    const reportText = `VP NAME: ${form.name}
DATE: ${form.date}
CLIENT: ${form.client || 'Not specified'}
HOURS: ${form.hours || 'Not specified'}

COMPLETED TODAY:
${form.completed}

IN PROGRESS / PENDING:
${form.pending || 'None stated'}

NEXT ACTIONS:
${form.nextActions || 'None stated'}

RISKS / ROADBLOCKS:
${form.blockers || 'None stated'}

PROACTIVE RECOMMENDATION:
${form.recommendation}

LINKS:
${linksText}

MOOD: ${mood || 'Not selected'}
TOMORROW: ${form.tomorrow || 'Not stated'}`

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportText }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'API error')
      }
      const result: ReviewResult = await res.json()
      setReview(result)
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      name: '',
      date: new Date().toISOString().split('T')[0],
      client: '',
      hours: '',
      completed: '',
      pending: '',
      nextActions: '',
      blockers: '',
      recommendation: '',
      tomorrow: '',
    })
    setMood('')
    setLinks([])
    setReview(null)
    setApiError(null)
    setLoading(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showReviewPanel = loading || review !== null || apiError

  return (
    <div id="app">

      {/* Header */}
      <div className="gvt-header">
        <div className="gvt-logo-mark">GV</div>
        <div>
          <h1>End of Day Report</h1>
          <p>Genesis Virtual Team — daily performance log</p>
        </div>
      </div>

      {/* Best Practice Guide */}
      <div className="bp-panel">
        <h3><i className="ti ti-star" aria-hidden="true" /> Best practice guide</h3>
        <div className="bp-grid">
          {[
            { rule: 'Group completed tasks by project', eg: 'e.g. "GVT Website: • Added staging site on WordPress..."' },
            { rule: 'Write outcomes, not just activities', eg: 'Good: "Reconciled 47 transactions in Xero" — Not: "Did Xero work"' },
            { rule: 'Include a specific proactive recommendation', eg: 'One concrete idea your client could act on — not generic advice' },
            { rule: 'Add target deadlines to next actions', eg: 'e.g. "Finalise GVT website — Target deadline: Wednesday, 23 April"' },
            { rule: 'Link every output with a descriptive label', eg: 'Good: "View GVT Content Calendar" + direct URL — Not: "Canva link"' },
          ].map((item, i) => (
            <div className="bp-row" key={i}>
              <div className="bp-num">{i + 1}</div>
              <div>
                <div className="bp-rule">{item.rule}</div>
                <div className="bp-eg">{item.eg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Meter */}
      <div className="meter-wrap">
        <div className="meter-top">
          <div className="meter-label">
            <i className="ti ti-activity" aria-hidden="true" /> Report quality
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: meterTextColor, transition: 'color 0.3s' }}>
            {meter.score} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>/ 10</span>
          </div>
        </div>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${meter.score * 10}%`, background: meterColor }} />
        </div>
        <div className="meter-criteria">
          {[
            ['tasks',     'Tasks completed filled'],
            ['grouped',   'Grouped by project'],
            ['outcomes',  'Outcomes / specifics'],
            ['recommend', 'Proactive recommendation'],
            ['deadlines', 'Deadlines in next actions'],
            ['links',     'Links added'],
            ['blockers',  'Blockers addressed'],
            ['tomorrow',  "Tomorrow's priority set"],
          ].map(([key, label]) => (
            <div key={key} className={`crit-item ${meter.checks[key as keyof typeof meter.checks] ? 'pass' : ''}`}>
              <div className="crit-dot" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── FORM ── */}

      {/* Your Details */}
      <div className="card">
        <div className="section-label">your details</div>
        <div className="meta-row" style={{ marginBottom: '1rem' }}>
          <div className="field-group">
            <label><i className="ti ti-user" aria-hidden="true" /> Your name <span className="req">*</span></label>
            <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Maria Santos" />
          </div>
          <div className="field-group">
            <label><i className="ti ti-calendar" aria-hidden="true" /> Date</label>
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
        </div>
        <div className="meta-row">
          <div className="field-group">
            <label><i className="ti ti-briefcase" aria-hidden="true" /> Client / employer</label>
            <input type="text" value={form.client} onChange={e => setField('client', e.target.value)} placeholder="e.g. Bright Accounting AU" />
          </div>
          <div className="field-group">
            <label><i className="ti ti-clock" aria-hidden="true" /> Hours logged today</label>
            <input type="number" value={form.hours} onChange={e => setField('hours', e.target.value)} min={0} max={12} step={0.5} placeholder="e.g. 8" />
          </div>
        </div>
      </div>

      {/* Tasks Completed */}
      <div className="card">
        <div className="section-label">tasks completed today</div>
        <div className="field-group">
          <label><i className="ti ti-check" aria-hidden="true" /> What did you complete today? <span className="req">*</span></label>
          <textarea
            rows={7}
            value={form.completed}
            onChange={e => setField('completed', e.target.value)}
            placeholder={"Group by project:\n\nGVT Website:\n• Added landing staging site on WordPress with revisions.\n• Updated the site icon to our new logo when viewed in browser.\n\nGVT May Content Calendar:\n• Created the GVT May editorial on Canva."}
          />
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
          <textarea
            rows={3}
            value={form.nextActions}
            onChange={e => setField('nextActions', e.target.value)}
            placeholder={"• Finalise GVT website on WordPress — Target deadline: Wednesday, 23 April\n• Begin May content generation — Target timeline: 23–25 April"}
          />
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
              <span>Task / output name</span>
              <span>URL</span>
              <span />
            </div>
          )}
          <div className="links-block">
            {links.map(link => (
              <div className="link-row" key={link.id}>
                <input
                  type="text"
                  placeholder="View GVT Content Calendar"
                  value={link.label}
                  onChange={e => updateLink(link.id, 'label', e.target.value)}
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={link.url}
                  onChange={e => updateLink(link.id, 'url', e.target.value)}
                />
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
              <button
                key={option}
                className={`mood-btn ${mood === option ? 'selected' : ''}`}
                onClick={() => setMood(option)}
              >
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

      <button className="submit-btn" onClick={submitReport} disabled={loading}>
        {loading
          ? <><i className="ti ti-loader" aria-hidden="true" /> Reviewing...</>
          : <><i className="ti ti-send" aria-hidden="true" /> Submit and get AI review</>
        }
      </button>

      {/* Review Panel */}
      {showReviewPanel && (
        <div className="review-panel" ref={reviewRef}>
          <div className="review-header">
            <span><i className="ti ti-robot" aria-hidden="true" /> AI review</span>
            {review && <span className="score-badge">{review.score}/10</span>}
          </div>
          <div className="review-body">
            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                Reviewing your report — this takes about 10 seconds...
              </div>
            )}
            {apiError && (
              <div className="loading-state" style={{ color: '#993C1D' }}>
                <i className="ti ti-alert-circle" aria-hidden="true" />
                Error: {apiError}
              </div>
            )}
            {review && <ReviewBody review={review} onReset={resetForm} />}
          </div>
        </div>
      )}

      <footer>Genesis Virtual Team &copy; 2025 &mdash; EODR System</footer>
    </div>
  )
}

function ReviewBody({ review, onReset }: { review: ReviewResult; onReset: () => void }) {
  const isGood = review.score >= 7
  return (
    <>
      <div className="review-section">
        <h3><i className="ti ti-report-analytics" aria-hidden="true" /> Overall</h3>
        <p style={{ marginBottom: 10 }}>
          <span className={`status-pill ${isGood ? 'pill-pass' : 'pill-needs'}`}>
            <i className={`ti ${isGood ? 'ti-circle-check' : 'ti-circle-x'}`} aria-hidden="true" />
            {review.verdict}
          </span>
        </p>
        <p>{review.summary}</p>
      </div>

      <div className="review-section">
        <h3><i className="ti ti-thumb-up" aria-hidden="true" /> What worked well</h3>
        <ul>{review.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>

      <div className="review-section">
        <h3><i className="ti ti-pencil" aria-hidden="true" /> Ways to improve</h3>
        <ul>{review.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>

      {review.links_feedback && (
        <div className="review-section">
          <h3><i className="ti ti-link" aria-hidden="true" /> Links feedback</h3>
          <p>{review.links_feedback}</p>
        </div>
      )}

      {review.followup_questions?.length > 0 && (
        <div className="review-section">
          <h3><i className="ti ti-message-question" aria-hidden="true" /> Follow-up questions</h3>
          <div className="followup-list">
            {review.followup_questions.map((q, i) => (
              <div className="followup-q" key={i}>{q}</div>
            ))}
          </div>
        </div>
      )}

      <button className="reset-btn" onClick={onReset}>
        <i className="ti ti-refresh" aria-hidden="true" /> Submit another report
      </button>
    </>
  )
}
