'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setConfirmed(true)
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ background: 'var(--gvt-teal)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: '#ff611a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/logo.png" alt="GVT" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>GVT Reporting</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Account created</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid var(--border)', padding: '2rem 1.5rem' }}>
            <div style={{ fontSize: 40, marginBottom: '1rem' }}>📧</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Check your email</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              We sent a confirmation link to <strong>{email}</strong>. Click the link in the email to activate your account.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Once confirmed, you can{' '}
              <a href="/login" style={{ color: 'var(--gvt-teal)', textDecoration: 'none', fontWeight: 500 }}>sign in here</a>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ background: 'var(--gvt-teal)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: '#ff611a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/logo.png" alt="GVT" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>GVT Reporting</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Create your account</div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid var(--border)', padding: '1.5rem' }}>
          <form onSubmit={handleSignup}>
            <div className="field-group">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Maria Santos"
                required
              />
            </div>
            <div className="field-group" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="field-group" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div style={{ marginTop: '0.75rem', padding: '10px 14px', background: '#FEF3EE', borderRadius: 8, fontSize: 13, color: '#993C1D', borderLeft: '3px solid var(--gvt-coral)' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="submit-btn"
              style={{ marginTop: '1.25rem' }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginTop: '1rem' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--gvt-teal)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
