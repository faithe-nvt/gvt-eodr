'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import HistoryTab from './components/HistoryTab'
import TasksTab from './components/TasksTab'

type Tab = 'today' | 'history' | 'tasks'

interface Badge { streak: number; qualityCount: number }

const STORAGE_KEY = 'gvt_report_v3'
const MIN_SCORE_TO_SEND = 7

interface LinkItem { id: number; label: string; url: string }
interface InProgressItem { id: number; text: string; progress: number }
interface NextActionItem { id: number; text: string; deadline: string }

interface FormState {
  date: string
  completed: string
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
  moodScore: number
  links: LinkItem[]
  inProgressItems: InProgressItem[]
  nextActionItems: NextActionItem[]
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
  submissionId: string
  grading: ReviewResult
  emailPreview: { subject: string; previewText: string; html: string; plainText: string }
  emailMatchStatus: string
}

const EMAIL_MATCH_LABELS: Record<string, { label: string; color: string }> = {
  match:                       { label: 'Email verified', color: '#0A505A' },
  flagged_typo:                { label: 'Possible typo flagged', color: '#BA7517' },
  flagged_different_recipient: { label: 'Different recipient flagged', color: '#993C1D' },
  flagged_new_domain:          { label: 'New domain flagged', color: '#993C1D' },
  no_trusted_email_on_file:    { label: 'No trusted email on file', color: '#555550' },
}

function moodLabel(score: number) {
  if (score <= 25) return 'Difficult'
  if (score <= 50) return 'Challenging'
  if (score <= 75) return 'Good'
  return 'Excellent'
}

export default function EODRPage() {
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null)
  const [form, setForm] = useState<FormState>({
    date: new Date().toISOString().split('T')[0],
    completed: '',
    blockers: '',
    recommendation: '',
    tomorrow: '',
  })
  const [delivery, setDelivery] = useState<DeliveryState>({ clientName: '', clientEmail: '' })
  const [moodScore, setMoodScore] = useState(50)
  const [links, setLinks] = useState<LinkItem[]>([])
  const [linkCounter, setLinkCounter] = useState(0)
  const [inProgressItems, setInProgressItems] = useState<InProgressItem[]>([{ id: 1, text: '', progress: 0 }])
  const [nextActionItems, setNextActionItems] = useState<NextActionItem[]>([{ id: 1, text: '', deadline: '' }])
  const [ipCounter, setIpCounter] = useState(1)
  const [naCounter, setNaCounter] = useState(1)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [savedReport, setSavedReport] = useState<SavedReport | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [sent, setSent] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [badge, setBadge] = useState<Badge>({ streak: 0, qualityCount: 0 })
  const reviewRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
      if (prof) setProfile(prof)

      // Load submissions for badges
      const { data: subs } = await supabase
        .from('eodr_submissions')
        .select('created_at, ai_grade')
        .eq('vp_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (subs) {
        const qualityCount = subs.filter(s => (s.ai_grade ?? 0) >= 8).length
        const streak = calcStreak(subs.map(s => s.created_at))
        setBadge({ streak, qualityCount })
      }
    })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSavedReport(JSON.parse(raw))
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // In Progress
  function addInProgress() {
    const id = ipCounter + 1; setIpCounter(id)
    setInProgressItems(prev => [...prev, { id, text: '', progress: 0 }])
  }
  function removeInProgress(id: number) { setInProgressItems(prev => prev.filter(i => i.id !== id)) }
  function updateInProgress(id: number, field: 'text' | 'progress', value: string | number) {
    setInProgressItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // Next Actions
  function addNextAction() {
    const id = naCounter + 1; setNaCounter(id)
    setNextActionItems(prev => [...prev, { id, text: '', deadline: '' }])
  }
  function removeNextAction(id: number) { setNextActionItems(prev => prev.filter(i => i.id !== id)) }
  function updateNextAction(id: number, field: 'text' | 'deadline', value: string) {
    setNextActionItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // Links
  function addLink() {
    const id = linkCounter + 1; setLinkCounter(id)
    setLinks(prev => [...prev, { id, label: '', url: '' }])
  }
  function removeLink(id: number) { setLinks(prev => prev.filter(l => l.id !== id)) }
  function updateLink(id: number, field: 'label' | 'url', value: string) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  function loadPrevious() {
    if (!savedReport) return
    if (savedReport.inProgressItems?.length) setInProgressItems(savedReport.inProgressItems)
    if (savedReport.nextActionItems?.length) setNextActionItems(savedReport.nextActionItems)
    setDelivery(prev => ({
      ...prev,
      clientName: savedReport.delivery?.clientName ?? '',
      clientEmail: savedReport.delivery?.clientEmail ?? '',
    }))
    setBannerDismissed(true)
  }

  async function submitReport() {
    const missing: string[] = []
    if (!form.completed.trim()) missing.push('completed tasks')
    if (inProgressItems.every(i => !i.text.trim())) missing.push('in progress items')
    if (nextActionItems.every(i => !i.text.trim())) missing.push('next actions')
    if (!form.blockers.trim()) missing.push('risks / roadblocks')
    if (!form.recommendation.trim()) missing.push('recommendation')
    if (!form.tomorrow.trim()) missing.push("tomorrow's priority")
    if (!delivery.clientName.trim()) missing.push('client name')
    if (!delivery.clientEmail.trim()) missing.push('client email')
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.join(', ')}.`)
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery.clientEmail)) {
      alert('Please enter a valid client email address.')
      return
    }

    setLoading(true)
    setApiError(null)
    setSubmitResult(null)
    setSent(false)

    const pendingText = inProgressItems
      .filter(i => i.text.trim())
      .map(i => `• ${i.text} (${i.progress}% complete)`)
      .join('\n')

    const nextActionsText = nextActionItems
      .filter(i => i.text.trim())
      .map(i => `• ${i.text}${i.deadline ? ` — Deadline: ${i.deadline}` : ''}`)
      .join('\n')

    const snapshot: SavedReport = { savedDate: form.date, form, delivery, moodScore, links, inProgressItems, nextActionItems }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    setSavedReport(snapshot)

    setTimeout(() => { reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, 100)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: { ...form, pending: pendingText, nextActions: nextActionsText, links, mood: moodLabel(moodScore) },
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
    setForm({ date: new Date().toISOString().split('T')[0], completed: '', blockers: '', recommendation: '', tomorrow: '' })
    setDelivery({ clientName: '', clientEmail: '' })
    setMoodScore(50)
    setLinks([])
    setInProgressItems([{ id: 1, text: '', progress: 0 }])
    setNextActionItems([{ id: 1, text: '', deadline: '' }])
    setIpCounter(1); setNaCounter(1)
    setSubmitResult(null)
    setApiError(null)
    setLoading(false)
    setShowEmailPreview(false)
    setSent(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showReviewPanel = loading || submitResult !== null || !!apiError
  const canSend = (submitResult?.grading.score ?? 0) >= MIN_SCORE_TO_SEND

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
            <div style={{ fontWeight: 500, color: '#fff', marginBottom: 4 }}>{profile.full_name}</div>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
              {badge.streak >= 2 && (
                <span title={`${badge.streak}-day streak`} style={{ fontSize: 10, background: 'rgba(255,97,26,0.25)', color: '#ff9a6e', padding: '2px 7px', borderRadius: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i className="ti ti-flame" style={{ fontSize: 11 }} /> {badge.streak}d streak
                </span>
              )}
              {badge.qualityCount >= 1 && (
                <span title={`${badge.qualityCount} high-quality reports (8+)`} style={{ fontSize: 10, background: 'rgba(92,232,200,0.2)', color: '#5CE8C8', padding: '2px 7px', borderRadius: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i className="ti ti-star" style={{ fontSize: 11 }} /> {badge.qualityCount}
                </span>
              )}
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11, padding: 0 }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', background: '#fff', borderRadius: 'var(--radius-lg)', padding: 4, border: '0.5px solid var(--border)' }}>
        {(['today', 'history', 'tasks'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? 'var(--gvt-teal)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            <i className={`ti ${tab === 'today' ? 'ti-file-text' : tab === 'history' ? 'ti-history' : 'ti-checkbox'}`} style={{ marginRight: 5 }} />
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* History Tab */}
      {activeTab === 'history' && <HistoryTab />}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && <TasksTab />}

      {/* Today Tab */}
      {activeTab === 'today' && <>

      {/* Previous Report Banner */}
      {savedReport && !bannerDismissed && submitResult === null && (
        <div style={{ background: '#fff', border: '0.5px solid var(--gvt-teal)', borderRadius: 'var(--radius-lg)', padding: '0.9rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-history" style={{ color: 'var(--gvt-teal)', fontSize: 18 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Saved report from <strong>{savedReport.savedDate}</strong> — loads client, in-progress and next actions only.
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
            { rule: 'Add hard deadlines to next actions', eg: 'Set the date — not just "next week"' },
            { rule: 'Link every output with a descriptive label', eg: 'Good: "View GVT Content Calendar" + direct URL — Not: "Canva link"' },
          ].map((item, i) => (
            <div className="bp-row" key={i}>
              <div className="bp-num">{i + 1}</div>
              <div><div className="bp-rule">{item.rule}</div><div className="bp-eg">{item.eg}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks Completed */}
      <div className="card">
        <div className="section-label">tasks completed today <span className="req">*</span></div>
        <div className="field-group">
          <label><i className="ti ti-check" aria-hidden="true" /> What did you complete today?</label>
          <textarea rows={7} value={form.completed} onChange={e => setField('completed', e.target.value)}
            placeholder={"Group by project:\n\nGVT Website:\n• Added landing staging site on WordPress with revisions.\n• Updated the site icon to our new logo when viewed in browser.\n\nGVT May Content Calendar:\n• Created the GVT May editorial on Canva."} />
          <div className="hint">Group tasks by project. Outcomes and numbers make stronger reports.</div>
        </div>
      </div>

      {/* In Progress */}
      <div className="card">
        <div className="section-label">in progress <span className="req">*</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {inProgressItems.map(item => (
            <div key={item.id} style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  value={item.text}
                  onChange={e => updateInProgress(item.id, 'text', e.target.value)}
                  placeholder="Describe what is in progress..."
                  style={{ flex: 1 }}
                />
                {inProgressItems.length > 1 && (
                  <button className="link-remove" onClick={() => removeInProgress(item.id)} aria-label="Remove">
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>0%</span>
                <input
                  type="range" min={0} max={100} step={10}
                  value={item.progress}
                  onChange={e => updateInProgress(item.id, 'progress', Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--gvt-teal)', height: 4, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>100%</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gvt-teal)', minWidth: 42, textAlign: 'right', flexShrink: 0 }}>{item.progress}%</span>
              </div>
            </div>
          ))}
        </div>
        <button className="add-link-btn" onClick={addInProgress} style={{ marginTop: 12 }}>
          <i className="ti ti-plus" aria-hidden="true" /> Add item
        </button>
      </div>

      {/* Next Actions */}
      <div className="card">
        <div className="section-label">next actions <span className="req">*</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nextActionItems.map(item => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={item.text}
                onChange={e => updateNextAction(item.id, 'text', e.target.value)}
                placeholder="Next action..."
              />
              <input
                type="date"
                value={item.deadline}
                onChange={e => updateNextAction(item.id, 'deadline', e.target.value)}
                title="Hard deadline"
                style={{ width: 150 }}
              />
              {nextActionItems.length > 1 && (
                <button className="link-remove" onClick={() => removeNextAction(item.id)} aria-label="Remove">
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 6 }}>Set a hard deadline date for each action.</div>
        <button className="add-link-btn" onClick={addNextAction} style={{ marginTop: 10 }}>
          <i className="ti ti-plus" aria-hidden="true" /> Add action
        </button>
      </div>

      {/* Blockers */}
      <div className="card">
        <div className="section-label">risks and roadblocks <span className="req">*</span></div>
        <div className="field-group">
          <label><i className="ti ti-alert-triangle" aria-hidden="true" /> Risks / roadblocks / action needed from manager</label>
          <textarea rows={3} value={form.blockers} onChange={e => setField('blockers', e.target.value)}
            placeholder="Describe anything needing attention or sign-off. If none, write 'None at this time'." />
        </div>
      </div>

      {/* Recommendation */}
      <div className="card">
        <div className="section-label">proactive thinking <span className="req">*</span></div>
        <div className="field-group">
          <label><i className="ti ti-bulb" aria-hidden="true" /> One recommendation for your client&apos;s business or processes</label>
          <textarea rows={4} value={form.recommendation} onChange={e => setField('recommendation', e.target.value)}
            placeholder="What did you observe today that could be done faster, smarter, or better? One specific, actionable idea." />
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
        <div className="section-label">end of day reflection <span className="req">*</span></div>
        <div className="field-group">
          <label><i className="ti ti-mood-smile" aria-hidden="true" /> How did today feel?</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 4px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 56 }}>Difficult</span>
            <input
              type="range" min={0} max={100} step={1}
              value={moodScore}
              onChange={e => setMoodScore(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--gvt-teal)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 56, textAlign: 'right' }}>Excellent</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--gvt-teal)', marginTop: 4 }}>
            {moodLabel(moodScore)} — {moodScore}%
          </div>
        </div>
        <div className="divider" />
        <div className="field-group">
          <label><i className="ti ti-target" aria-hidden="true" /> Priority for tomorrow <span className="req">*</span></label>
          <textarea rows={2} value={form.tomorrow} onChange={e => setField('tomorrow', e.target.value)}
            placeholder="The one thing to get done first tomorrow." />
        </div>
      </div>

      {/* Delivery Settings */}
      <div className="card">
        <div className="section-label">delivery settings</div>
        <div className="meta-row" style={{ marginBottom: '1rem' }}>
          <div className="field-group">
            <label><i className="ti ti-building" aria-hidden="true" /> Client name <span className="req">*</span></label>
            <input type="text" value={delivery.clientName} onChange={e => setDelivery(p => ({ ...p, clientName: e.target.value }))} placeholder="e.g. Bright Accounting AU" />
          </div>
          <div className="field-group">
            <label><i className="ti ti-mail" aria-hidden="true" /> Client email <span className="req">*</span></label>
            <input type="email" value={delivery.clientEmail} onChange={e => setDelivery(p => ({ ...p, clientEmail: e.target.value }))} placeholder="client@example.com.au" />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
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

      {/* Review Panel */}
      {showReviewPanel && (
        <div className="review-panel" ref={reviewRef}>
          <div className="review-header">
            <span><i className="ti ti-robot" aria-hidden="true" /> AI review</span>
            {submitResult && (
              <div style={{ textAlign: 'center' }}>
                <span className="score-badge">{submitResult.grading.score}/10</span>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI Score</div>
              </div>
            )}
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
                canSend={canSend}
                sent={sent}
                onSent={() => setSent(true)}
                showEmailPreview={showEmailPreview}
                onToggleEmail={() => setShowEmailPreview(p => !p)}
                onReset={resetForm}
              />
            )}
          </div>
        </div>
      )}

      </> /* end Today tab */}

      <footer>Genesis Virtual Team &copy; 2025 &mdash; EODR System</footer>
    </div>
  )
}

function ReviewBody({ result, canSend, sent, onSent, showEmailPreview, onToggleEmail, onReset }: {
  result: SubmitResult
  canSend: boolean
  sent: boolean
  onSent: () => void
  showEmailPreview: boolean
  onToggleEmail: () => void
  onReset: () => void
}) {
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  async function handleSend() {
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: result.submissionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Send failed')
      }
      onSent()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

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

        {!canSend && !sent && (
          <div style={{ marginBottom: 10, padding: '10px 14px', background: '#FEF3EE', borderRadius: 8, fontSize: 13, color: '#993C1D', borderLeft: '3px solid var(--gvt-coral)' }}>
            <i className="ti ti-lock" aria-hidden="true" style={{ marginRight: 6 }} />
            Your AI score needs to be {MIN_SCORE_TO_SEND}/10 or above to send to the client. Improve your report and resubmit.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onToggleEmail}
            style={{ fontSize: 13, color: 'var(--gvt-teal)', background: 'var(--gvt-mint-bg)', border: '0.5px solid rgba(45,95,94,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className={`ti ${showEmailPreview ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
            {showEmailPreview ? 'Hide preview' : 'Preview email'}
          </button>

          {!sent && (
            <button
              onClick={handleSend}
              disabled={sending || !canSend}
              title={!canSend ? `Score must be ${MIN_SCORE_TO_SEND}/10 or above to send` : ''}
              style={{ fontSize: 13, color: '#fff', background: canSend ? 'var(--gvt-teal)' : '#ccc', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: (sending || !canSend) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: sending ? 0.6 : 1 }}
            >
              <i className={`ti ${sending ? 'ti-loader' : canSend ? 'ti-send' : 'ti-lock'}`} aria-hidden="true" />
              {sending ? 'Sending...' : 'Send to client'}
            </button>
          )}

          {sent && (
            <div style={{ fontSize: 13, color: '#0A505A', background: 'var(--gvt-mint-bg)', border: '0.5px solid rgba(45,95,94,0.3)', borderRadius: 'var(--radius-md)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-circle-check" aria-hidden="true" /> Sent successfully
            </div>
          )}
        </div>

        {sendError && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#993C1D', padding: '8px 12px', background: '#FEF3EE', borderRadius: 8 }}>
            {sendError}
          </div>
        )}

        {showEmailPreview && (
          <div style={{ marginTop: 12, border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <iframe srcDoc={emailPreview.html} style={{ width: '100%', height: 600, border: 'none' }} title="Email preview" />
          </div>
        )}
      </div>

      {/* Submit Another only shown after sending */}
      {sent && (
        <button className="reset-btn" onClick={onReset}>
          <i className="ti ti-refresh" aria-hidden="true" /> Submit another report
        </button>
      )}
    </>
  )
}
