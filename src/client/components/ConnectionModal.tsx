import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Connection } from '../../types'

interface ConnectionModalProps {
  connections: Connection[]
  onClose: () => void
}

export function ConnectionModal({ connections, onClose }: ConnectionModalProps) {
  const [name, setName] = useState('')
  const [connStr, setConnStr] = useState('')
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const qc = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.connections.post({ name, connectionString: connStr })
      if (res.error) throw new Error((res.error as { value?: { error?: string } }).value?.error ?? 'Failed to add connection')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] })
      setName('')
      setConnStr('')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (connName: string) => {
      const encoded = encodeURIComponent(connName)
      const res = await api.api.connections({ name: encoded }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] })
  })

  const handleTest = async () => {
    setTestResult('idle')
    setTestError('')
    try {
      const res = await api.api.connections.test.post({ connectionString: connStr })
      if (res.error || (res.data as { ok: boolean }).ok === false) {
        setTestResult('error')
        setTestError((res.data as { error?: string })?.error ?? 'Connection failed')
      } else {
        setTestResult('ok')
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 'var(--r)',
          border: '1px solid var(--border)', padding: 24, width: 440,
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)' }}>
          Manage Connections
        </h2>

        {connections.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            No connections yet. Add one below.
          </p>
        )}

        {connections.map(c => (
          <div key={c.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok-color)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</span>
            <button
              onClick={() => deleteMutation.mutate(c.name)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-3)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}
            >
              Remove
            </button>
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Connection name (e.g. Local Dev)"
            style={inputStyle}
          />
          <input
            value={connStr}
            onChange={e => { setConnStr(e.target.value); setTestResult('idle') }}
            placeholder="Server=...;Database=...;User Id=...;Password=..."
            style={inputStyle}
          />
          {testResult === 'error' && testError && (
            <div style={{ fontSize: 12, color: 'var(--err-color)', padding: '6px 10px', background: 'var(--err-bg)', borderRadius: 6 }}>
              {testError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleTest}
              disabled={!connStr}
              style={{
                padding: '8px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                cursor: connStr ? 'pointer' : 'not-allowed',
                color: testResult === 'ok' ? '#22C55E' : testResult === 'error' ? '#EF4444' : 'var(--text-2)',
              }}
            >
              {testResult === 'ok' ? '✓ Connected' : testResult === 'error' ? '✗ Failed' : 'Test'}
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!name || !connStr || addMutation.isPending}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 'var(--r-sm)',
                background: name && connStr ? 'var(--accent-grad)' : 'rgba(255,255,255,0.1)',
                border: 'none', color: 'white', cursor: name && connStr ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              }}
            >
              {addMutation.isPending ? 'Adding…' : 'Add Connection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  width: '100%',
}
