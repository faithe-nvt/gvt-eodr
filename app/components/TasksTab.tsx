'use client'

import { useState, useEffect } from 'react'

interface Task {
  id: number
  text: string
  project: string
  done: boolean
  createdAt: string
}

function todayKey() {
  return `gvt_tasks_${new Date().toLocaleDateString('en-CA')}`
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newText, setNewText] = useState('')
  const [newProject, setNewProject] = useState('')
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

  function addTask() {
    if (!newText.trim()) return
    const id = counter + 1
    setCounter(id)
    save([...tasks, { id, text: newText.trim(), project: newProject.trim(), done: false, createdAt: new Date().toISOString() }])
    setNewText('')
    setNewProject('')
  }

  function toggleTask(id: number) {
    save(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function deleteTask(id: number) {
    save(tasks.filter(t => t.id !== id))
  }

  function clearDone() {
    save(tasks.filter(t => !t.done))
  }

  const pending = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  const projects = [...new Set(tasks.map(t => t.project).filter(Boolean))]

  return (
    <div>
      {/* Add task */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label">add task</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Task description..."
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newProject}
              onChange={e => setNewProject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Project (optional)"
              style={{ flex: 1 }}
              list="project-list"
            />
            <datalist id="project-list">
              {projects.map(p => <option key={p} value={p} />)}
            </datalist>
            <button
              onClick={addTask}
              style={{ background: 'var(--gvt-teal)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              <i className="ti ti-plus" /> Add
            </button>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-tertiary)', fontSize: 14 }}>
          <i className="ti ti-checkbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
          No tasks yet. Add tasks above to track your work throughout the day.
        </div>
      ) : (
        <>
          {/* Pending tasks */}
          {pending.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="section-label" style={{ marginBottom: 12 }}>to do — {pending.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => toggleTask(task.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--gvt-teal)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{task.text}</div>
                      {task.project && (
                        <div style={{ fontSize: 11, color: 'var(--gvt-teal)', marginTop: 2, fontWeight: 500 }}>{task.project}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="link-remove"
                      aria-label="Delete task"
                      style={{ opacity: 0.5 }}
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done tasks */}
          {done.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>completed — {done.length}</div>
                <button
                  onClick={clearDone}
                  style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Clear all
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {done.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border)', opacity: 0.6 }}>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleTask(task.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--gvt-teal)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through', lineHeight: 1.4 }}>{task.text}</div>
                      {task.project && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{task.project}</div>
                      )}
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="link-remove" aria-label="Delete" style={{ opacity: 0.4 }}>
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
