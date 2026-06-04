'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Submission {
  id: string
  created_at: string
  client_name: string
  client_email_entered: string
  ai_grade: number | null
  send_status: string
  email_subject: string | null
  form_data: Record<string, unknown>
  email_html: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  sent:                 { label: 'Sent', color: '#0A505A' },
  pending_verification: { label: 'Pending', color: '#BA7517' },
  failed:               { label: 'Failed', color: '#993C1D' },
  cancelled:            { label: 'Cancelled', color: '#999' },
}

export default function HistoryTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showEmail, setShowEmail] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadSubmissions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSubmissions() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase
      .from('eodr_submissions')
      .select('id,created_at,client_name,client_email_entered,ai_grade,send_status,email_subject,form_data,email_html')
      .eq('vp_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data } = await query
    setSubmissions(data ?? [])
    setLoading(false)
  }

  const filtered = submissions.filter(s => {
    const matchSearch = !search ||
      s.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email_subject ?? '').toLowerCase().includes(search.toLowerCase())
    const date = s.created_at.split('T')[0]
    const matchFrom = !dateFrom || date >= dateFrom
    const matchTo = !dateTo || date <= dateTo
    return matchSearch && matchFrom && matchTo
  })

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  function scoreColor(score: number | null) {
    if (!score) return '#999'
    if (score >= 8) return '#0A505A'
    if (score >= 6) return '#BA7517'
    return '#993C1D'
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        Loading submissions...
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label">filter submissions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', marginTop: 8 }}>
          <input
            type="text"
            placeholder="Search by client or subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" style={{ width: 150 }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" style={{ width: 150 }} />
        </div>
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
            style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Submissions List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-tertiary)', fontSize: 14 }}>
          <i className="ti ti-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
          {submissions.length === 0 ? 'No submissions yet.' : 'No submissions match your filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => {
            const status = STATUS_LABELS[s.send_status] ?? { label: s.send_status, color: '#999' }
            const isExpanded = expanded === s.id
            return (
              <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{s.client_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(s.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor(s.ai_grade), textAlign: 'center' }}>
                    {s.ai_grade != null ? `${s.ai_grade}/10` : '—'}
                    <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Score</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: status.color, padding: '3px 10px', borderRadius: 20, background: '#f5f5f0', whiteSpace: 'nowrap' }}>
                    {status.label}
                  </span>
                  <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ color: 'var(--text-tertiary)', fontSize: 14 }} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '0.5px solid var(--border)', padding: '14px 16px', background: 'var(--surface-2)' }}>
                    {s.email_subject && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        <strong>Subject:</strong> {s.email_subject}
                      </div>
                    )}
                    {s.form_data?.completed && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        <strong>Tasks completed:</strong>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                          {String(s.form_data.completed).slice(0, 300)}{String(s.form_data.completed).length > 300 ? '...' : ''}
                        </div>
                      </div>
                    )}
                    {s.email_html && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => setShowEmail(showEmail === s.id ? null : s.id)}
                          style={{ fontSize: 12, color: 'var(--gvt-teal)', background: 'var(--gvt-mint-bg)', border: '0.5px solid rgba(45,95,94,0.2)', borderRadius: 'var(--radius-md)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <i className={`ti ${showEmail === s.id ? 'ti-eye-off' : 'ti-eye'}`} />
                          {showEmail === s.id ? 'Hide email' : 'View sent email'}
                        </button>
                        {showEmail === s.id && (
                          <div style={{ marginTop: 10, border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                            <iframe srcDoc={s.email_html} style={{ width: '100%', height: 500, border: 'none' }} title="Sent email" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
