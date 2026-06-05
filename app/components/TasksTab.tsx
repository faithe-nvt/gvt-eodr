'use client'

import { useState, useEffect } from 'react'

interface Subtask {
  id: number
  text: string
  done: boolean
}

interface Task {
  id: number
  text: string
  subtasks: Subtask[]
  done: boolean
  createdAt: string
}

function todayKey() {
  return `gvt_tasks_${new Date().toLocaleDateString('en-CA')}`
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newText, setNewText] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [pendingSubtasks, setPendingSubtasks] = useState<Subtask[]>([])
  const [subCounter, setSubCounter] = useState(0)
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey())
      if (raw) setTasks(JSON.parse(raw))
    } catch {}
  }, [])

  function save(updated: Task[]) {
    setTasks(updated)
    localStorage.setItem(todayKey(), JSON.stringify(updated))
  }

  function addSubtask() {
    if (!newSubtask.trim()) return
    const id = subCounter + 1
    setSubCounter(id)
    setPendingSubtasks(prev => [...prev, { id, text: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  function removePendingSubtask(id: number) {
    setPendingSubtasks(prev => prev.filter(s => s.id !== id))
  }

  function addTask() {
    if (!newText.trim()) return
    const id = counter + 1
    setCounter(id)
    save([...tasks, {
      id,
      text: newText.trim(),
      subtasks: pendingSubtasks,
      done: false,
      createdAt: new Date().toISOString(),
    }])
    setNewText('')
    setNewSubtask('')
    setPendingSubtasks([])
  }

  function toggleTask(id: number) {
    save(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function toggleSubtask(taskId: number, subId: number) {
    save(tasks.map(t => t.id === taskId
      ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) }
      : t
    ))
  }

  function deleteTask(id: number) {
    save(tasks.filter(t => t.id !== id))
  }

  function clearDone() {
    save(tasks.filter(t => !t.done))
  }

  const pending = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <div>
      {/* Add Task Card */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label" style={{ marginBottom: 12 }}>add task</div>

        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Task description..."
          style={{ marginBottom: 10 }}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: pendingSubtasks.length > 0 ? 8 : 0 }}>
          <input
            type="text"
            value={newSubtask}
            onChange={e => setNewSubtask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubtask()}
            placeholder="Add a subtask..."
            style={{ flex: 1 }}
          />
          <button
            onClick={addSubtask}
            style={{
              background: 'var(--surface-2)', color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <i className="ti ti-plus" /> Add subtask
          </button>
        </div>

        {/* Pending subtasks preview */}
        {pendingSubtasks.length > 0 && (
          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pendingSubtasks.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <i className="ti ti-corner-down-right" style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
                <span style={{ flex: 1 }}>{s.text}</span>
                <button onClick={() => removePendingSubtask(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, fontSize: 13 }}>
                  <i className="ti ti-x" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={addTask}
          disabled={!newText.trim()}
          style={{
            width: '100%', padding: '10px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', background: 'none',
            fontSize: 13, fontWeight: 500, cursor: newText.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', color: newText.trim() ? 'var(--text-primary)' : 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          <i className="ti ti-plus" /> Add Task
        </button>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-tertiary)', fontSize: 14 }}>
          <i className="ti ti-checkbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
          No tasks yet. Add tasks above to track your work throughout the day.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              {pending.map(task => (
                <div key={task.id} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={false} onChange={() => toggleTask(task.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--gvt-teal)', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{task.text}</span>
                    <button onClick={() => deleteTask(task.id)} className="link-remove" style={{ opacity: 0.4 }}>
                      <i className="ti ti-x" />
                    </button>
                  </div>
                  {task.subtasks.length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {task.subtasks.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(task.id, s.id)}
                            style={{ width: 14, height: 14, accentColor: 'var(--gvt-teal)', cursor: 'pointer', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: s.done ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: s.done ? 'line-through' : 'none' }}>
                            {s.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>completed — {done.length}</div>
                <button onClick={clearDone} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear all
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {done.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.55 }}>
                    <input type="checkbox" checked={true} onChange={() => toggleTask(task.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--gvt-teal)', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{task.text}</span>
                    <button onClick={() => deleteTask(task.id)} className="link-remove" style={{ opacity: 0.4 }}>
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
