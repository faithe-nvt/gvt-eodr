'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Sign in to your account</div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid var(--border)', padding: '1.5rem' }}>
          <form onSubmit={handleLogin}>
            <div className="field-group">
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
                placeholder="••••••••"
                required
                autoComplete="current-password"
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginTop: '1rem' }}>
            No account?{' '}
            <a href="/signup" style={{ color: 'var(--gvt-teal)', textDecoration: 'none', fontWeight: 500 }}>
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
