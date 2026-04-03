import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Connection, DbType } from '../../types'
import { TablePicker } from './TablePicker'

interface ConnectionModalProps {
  connections: Connection[]
  onClose: () => void
}

const DB_TYPE_LABELS: Record<DbType, string> = {
  sqlserver: 'SQL Server',
  postgres: 'Postgres',
  sqlite: 'SQLite',
}

const CONN_STR_PLACEHOLDER: Record<DbType, string> = {
  sqlserver: 'Server=localhost;Database=mydb;User Id=sa;Password=...',
  postgres: 'postgresql://user:password@localhost:5432/mydb',
  sqlite: '/path/to/database.db',
}

export function ConnectionModal({ connections, onClose }: ConnectionModalProps) {
  const [name, setName] = useState('')
  const [connStr, setConnStr] = useState('')
  const [dbType, setDbType] = useState<DbType>('sqlserver')
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([])
  const [excludedSchemas, setExcludedSchemas] = useState<string[]>([])
  const [chipInput, setChipInput] = useState('')
  const chipInputRef = useRef<HTMLInputElement>(null)
  const [includedTables, setIncludedTables] = useState<string[]>([])
  const [availableTables, setAvailableTables] = useState<string[] | null>(null)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const qc = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async () => {
      // Test before saving
      const testRes = await api.api.connections.test.post({ connectionString: connStr, type: dbType })
      const testData = testRes.data as { ok: boolean; schemas?: string[]; error?: string } | null
      if (testRes.error || !testData?.ok) {
        const msg = testData?.error ?? 'Connection failed'
        setTestResult('error')
        setTestError(msg)
        throw new Error(msg)
      }
      setTestResult('ok')
      setAvailableSchemas(testData.schemas ?? [])

      const res = await api.api.connections.post({
        name,
        connectionString: connStr,
        type: dbType,
        excludedSchemas,
        includedTables: includedTables.length ? includedTables : undefined,
      })
      if (res.error) throw new Error((res.error as { value?: { error?: string } }).value?.error ?? 'Failed to add connection')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] })
      setName('')
      setConnStr('')
      setDbType('sqlserver')
      setTestResult('idle')
      setAvailableSchemas([])
      setExcludedSchemas([])
      setChipInput('')
      setIncludedTables([])
      setAvailableTables(null)
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
    setAvailableSchemas([])
    try {
      const res = await api.api.connections.test.post({ connectionString: connStr, type: dbType })
      const data = res.data as { ok: boolean; schemas?: string[]; error?: string } | null
      if (res.error || !data?.ok) {
        setTestResult('error')
        setTestError(data?.error ?? 'Connection failed')
      } else {
        setTestResult('ok')
        setAvailableSchemas(data.schemas ?? [])
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  const addChip = (value: string) => {
    const schema = value.trim()
    if (schema && !excludedSchemas.includes(schema)) {
      setExcludedSchemas(prev => [...prev, schema])
    }
  }

  const removeChip = (schema: string) => {
    setExcludedSchemas(prev => prev.filter(s => s !== schema))
  }

  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === ' ' || e.key === 'Enter') && chipInput.trim()) {
      e.preventDefault()
      addChip(chipInput)
      setChipInput('')
    } else if (e.key === 'Backspace' && !chipInput && excludedSchemas.length) {
      setExcludedSchemas(prev => prev.slice(0, -1))
    }
  }

  const handleLoadTables = async () => {
    setLoadingTables(true)
    try {
      const res = await api.api.connections.tables.post({ connectionString: connStr, type: dbType })
      const data = res.data as { tables: string[] } | null
      setAvailableTables(data?.tables ?? [])
      setTablePickerOpen(true)
    } finally {
      setLoadingTables(false)
    }
  }

  const toggleAvailableSchema = (schema: string) => {
    if (excludedSchemas.includes(schema)) {
      removeChip(schema)
    } else {
      addChip(schema)
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
          border: '1px solid var(--border)', padding: 24, width: 460,
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {tablePickerOpen && availableTables && (
          <TablePicker
            tables={availableTables}
            selected={includedTables.length ? includedTables : availableTables}
            onChange={setIncludedTables}
            onClose={() => setTablePickerOpen(false)}
            title="Choose included tables"
          />
        )}
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
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{DB_TYPE_LABELS[c.type]}</span>
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
          {/* DB type segmented control */}
          <div style={{
            display: 'flex', gap: 2,
            background: 'var(--bg)', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-strong)', padding: 3,
          }}>
            {(['sqlserver', 'postgres', 'sqlite'] as DbType[]).map(t => (
              <button
                key={t}
                onClick={() => { setDbType(t); setTestResult('idle'); setAvailableSchemas([]) }}
                style={{
                  flex: 1, padding: '5px 8px',
                  borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  background: dbType === t ? 'var(--surface)' : 'transparent',
                  color: dbType === t ? 'var(--text-1)' : 'var(--text-3)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {DB_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Connection name (e.g. Local Dev)"
            style={inputStyle}
          />
          <input
            value={connStr}
            onChange={e => { setConnStr(e.target.value); setTestResult('idle'); setAvailableSchemas([]) }}
            placeholder={CONN_STR_PLACEHOLDER[dbType]}
            style={inputStyle}
          />

          {/* Schema exclusion */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Exclude schemas
            </div>

            {/* Available schemas (shown after successful test) */}
            {availableSchemas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                {availableSchemas.map(schema => {
                  const excluded = excludedSchemas.includes(schema)
                  return (
                    <button
                      key={schema}
                      onClick={() => toggleAvailableSchema(schema)}
                      style={{
                        padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${excluded ? 'var(--accent)' : 'var(--border-strong)'}`,
                        background: excluded ? 'var(--accent-light)' : 'transparent',
                        color: excluded ? 'var(--accent)' : 'var(--text-3)',
                      }}
                    >
                      {schema}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Chip input */}
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5,
                padding: '6px 10px', minHeight: 38,
                background: 'var(--bg)', border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-sm)', cursor: 'text',
              }}
              onClick={() => chipInputRef.current?.focus()}
            >
              {excludedSchemas.map(schema => (
                <span
                  key={schema}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 20,
                    background: 'var(--accent-light)', color: 'var(--accent)',
                    fontSize: 11, fontWeight: 600,
                  }}
                >
                  {schema}
                  <button
                    onClick={e => { e.stopPropagation(); removeChip(schema) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--accent)', padding: 0, lineHeight: 1,
                      fontSize: 13, display: 'flex', alignItems: 'center',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={chipInputRef}
                value={chipInput}
                onChange={e => setChipInput(e.target.value)}
                onKeyDown={handleChipKeyDown}
                placeholder={excludedSchemas.length === 0 ? 'Type a schema name, press space to add…' : ''}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 12,
                  minWidth: 120, flex: 1,
                }}
              />
            </div>
          </div>

          {/* Included tables filter */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Included tables
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleLoadTables}
                disabled={!connStr || loadingTables}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border-strong)', background: 'var(--bg)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  color: 'var(--text-2)', cursor: connStr ? 'pointer' : 'not-allowed',
                }}
              >
                {loadingTables ? 'Loading…' : 'Choose tables…'}
              </button>
              {includedTables.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {includedTables.length} selected
                </span>
              )}
              {includedTables.length > 0 && (
                <button
                  onClick={() => setIncludedTables([])}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: 'var(--text-3)', fontFamily: 'inherit', padding: 0,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {includedTables.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                All tables loaded by default
              </div>
            )}
          </div>

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
                color: testResult === 'ok' ? 'var(--ok-color)' : testResult === 'error' ? 'var(--err-color)' : 'var(--text-2)',
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
              {addMutation.isPending ? (testResult === 'ok' ? 'Adding…' : 'Testing…') : 'Add Connection'}
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
