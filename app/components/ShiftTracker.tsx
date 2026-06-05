'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ShiftState {
  status: 'idle' | 'active' | 'ended'
  startTime: string | null
  endTime: string | null
  date: string
}

function todayKey() {
  return `gvt_shift_${new Date().toLocaleDateString('en-CA')}`
}

function emptyShift(): ShiftState {
  return { status: 'idle', startTime: null, endTime: null, date: new Date().toLocaleDateString('en-CA') }
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  onShiftChange: (shift: ShiftState) => void
  vpName: string
}

export default function ShiftTracker({ onShiftChange, vpName }: Props) {
  const [shift, setShift] = useState<ShiftState>(emptyShift())
  const [elapsed, setElapsed] = useState(0)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey())
      if (raw) {
        const saved: ShiftState = JSON.parse(raw)
        setShift(saved)
        onShiftChange(saved)
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(new Date())
      if (shift.status === 'active' && shift.startTime) {
        setElapsed(Date.now() - new Date(shift.startTime).getTime())
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [shift.status, shift.startTime])

  function save(updated: ShiftState) {
    setShift(updated)
    localStorage.setItem(todayKey(), JSON.stringify(updated))
    onShiftChange(updated)
  }

  function startShift() {
    save({ ...emptyShift(), status: 'active', startTime: new Date().toISOString() })
  }

  function endShift() {
    save({ ...shift, status: 'ended', endTime: new Date().toISOString() })
  }

  const totalDuration = shift.startTime && shift.endTime
    ? formatElapsed(new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime())
    : null

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (shift.status === 'idle') {
    return (
      <div style={{
        background: 'var(--gvt-teal)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '1rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4, letterSpacing: '0.04em' }}>
            {now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} &nbsp;·&nbsp; {formatTime(now.toISOString())}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            Good {greeting()}, {vpName.split(' ')[0]}! 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 20 }}>
            Your EODR unlocks when you end your shift. Ready to go?
          </div>
          <button
            onClick={startShift}
            style={{
              background: '#fff', color: 'var(--gvt-teal)', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '11px 28px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <i className="ti ti-player-play" aria-hidden="true" /> Start my day
          </button>
        </div>
      </div>
    )
  }

  // ── ACTIVE ─────────────────────────────────────────────────────────────────
  if (shift.status === 'active') {
    return (
      <div style={{
        background: 'var(--gvt-teal)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            Shift started {shift.startTime ? `at ${formatTime(shift.startTime)}` : ''}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
            {formatElapsed(elapsed)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            EODR will unlock when you end your shift
          </div>
        </div>
        <button
          onClick={endShift}
          style={{
            background: '#ff611a', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-md)', padding: '10px 20px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
          }}
        >
          <i className="ti ti-player-stop" aria-hidden="true" /> End my shift
        </button>
      </div>
    )
  }

  // ── ENDED ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'var(--gvt-mint-bg)',
      border: '0.5px solid rgba(45,95,94,0.2)',
      borderRadius: 'var(--radius-lg)',
      padding: '1rem 1.25rem',
      marginBottom: '1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--gvt-dark)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2, fontWeight: 600 }}>
          Shift complete
        </div>
        <div style={{ fontSize: 14, color: 'var(--gvt-dark)', fontWeight: 500 }}>
          {shift.startTime && shift.endTime
            ? `${formatTime(shift.startTime)} – ${formatTime(shift.endTime)} · ${totalDuration}`
            : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          Your EODR is now unlocked. Fill it in and submit below.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-circle-check" style={{ color: 'var(--gvt-teal)', fontSize: 22 }} />
          <span style={{ fontSize: 13, color: 'var(--gvt-teal)', fontWeight: 600 }}>Ready to report</span>
        </div>
        <button
          onClick={startShift}
          style={{
            background: 'none', color: 'var(--gvt-teal)',
            border: '0.5px solid var(--gvt-teal)',
            borderRadius: 'var(--radius-md)', padding: '6px 12px',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <i className="ti ti-refresh" aria-hidden="true" /> New shift
        </button>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
