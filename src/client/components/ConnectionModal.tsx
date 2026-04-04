import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Database, PencilLine, Plus, Trash2, XCircle } from 'lucide-react'
import { api } from '../api/client'
import type { Connection, DbType } from '../../types'
import { TablePicker } from './TablePicker'
import styles from './ConnectionModal.module.css'

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
  const [editingName, setEditingName] = useState<string | null>(null)
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
  const [hideAllInitially, setHideAllInitially] = useState(false)
  const [testedSignature, setTestedSignature] = useState<string | null>(null)
  const qc = useQueryClient()

  const currentTestSignature = `${dbType}::${connStr}`

  function resetForm() {
    setEditingName(null)
    setName('')
    setConnStr('')
    setDbType('sqlserver')
    setTestResult('idle')
    setTestError('')
    setAvailableSchemas([])
    setExcludedSchemas([])
    setChipInput('')
    setIncludedTables([])
    setAvailableTables(null)
    setHideAllInitially(false)
    setTestedSignature(null)
  }

  function startEdit(conn: Connection) {
    setEditingName(conn.name)
    setName(conn.name)
    setConnStr(conn.connectionString)
    setDbType(conn.type)
    setExcludedSchemas(conn.excludedSchemas ?? [])
    setIncludedTables(conn.includedTables ?? [])
    setAvailableSchemas([])
    setTestResult('idle')
    setTestError('')
    setChipInput('')
    setAvailableTables(null)
    setHideAllInitially(conn.hideAllInitially ?? false)
    setTestedSignature(null)
  }

  async function runConnectionTest() {
    const res = await api.api.connections.test.post({ connectionString: connStr, type: dbType })
    const data = res.data as { ok: boolean; schemas?: string[]; error?: string } | null

    if (res.error || !data?.ok) {
      const msg = data?.error ?? 'Connection failed'
      setTestResult('error')
      setTestError(msg)
      setTestedSignature(null)
      throw new Error(msg)
    }

    setTestResult('ok')
    setTestError('')
    setAvailableSchemas(data.schemas ?? [])
    setTestedSignature(currentTestSignature)
    return data
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (testedSignature !== currentTestSignature) {
        await runConnectionTest()
      }

      const payload = {
        name,
        connectionString: connStr,
        type: dbType,
        excludedSchemas,
        includedTables: includedTables.length ? includedTables : undefined,
        hideAllInitially: hideAllInitially || undefined,
      }

      if (editingName !== null) {
        const encoded = encodeURIComponent(editingName)
        const res = await api.api.connections({ name: encoded }).put(payload)
        if (res.error) throw new Error((res.error as { value?: { error?: string } }).value?.error ?? 'Failed to save')
        return
      }

      const res = await api.api.connections.post(payload)
      if (res.error) throw new Error((res.error as { value?: { error?: string } }).value?.error ?? 'Failed to add connection')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (connName: string) => {
      const encoded = encodeURIComponent(connName)
      const res = await api.api.connections({ name: encoded }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })

  async function handleTest() {
    setTestResult('idle')
    setTestError('')
    setAvailableSchemas([])
    try {
      await runConnectionTest()
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  function addChip(value: string) {
    const schema = value.trim()
    if (schema && !excludedSchemas.includes(schema)) {
      setExcludedSchemas(prev => [...prev, schema])
    }
  }

  function removeChip(schema: string) {
    setExcludedSchemas(prev => prev.filter(s => s !== schema))
  }

  function handleChipKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === ' ' || e.key === 'Enter') && chipInput.trim()) {
      e.preventDefault()
      addChip(chipInput)
      setChipInput('')
    } else if (e.key === 'Backspace' && !chipInput && excludedSchemas.length) {
      setExcludedSchemas(prev => prev.slice(0, -1))
    }
  }

  async function handleLoadTables() {
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

  function toggleAvailableSchema(schema: string) {
    if (excludedSchemas.includes(schema)) {
      removeChip(schema)
    } else {
      addChip(schema)
    }
  }

  const testLabel =
    testResult === 'ok' ? 'Connected' :
    testResult === 'error' ? 'Failed' :
    'Test connection'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {tablePickerOpen && availableTables && (
          <TablePicker
            tables={availableTables}
            selected={includedTables.length ? includedTables : availableTables}
            onChange={setIncludedTables}
            onClose={() => setTablePickerOpen(false)}
            title="Choose included tables"
          />
        )}

        <div className={styles.header}>
          <div>
            <div className={styles.title}>Connections</div>
            <div className={styles.subtitle}>Manage live data sources and default loading behavior.</div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>Close</button>
        </div>

        <div className={styles.layout}>
          <section className={styles.registrySection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Saved sources</div>
              <div className={styles.sectionMeta}>{connections.length} total</div>
            </div>

            {connections.length === 0 ? (
              <div className={styles.emptyState}>
                No live connections yet. Add one on the right to get started.
              </div>
            ) : (
              <div className={styles.connectionList}>
                {connections.map(connection => {
                  const activeEdit = editingName === connection.name
                  return (
                    <div key={connection.name} className={`${styles.connectionCard} ${activeEdit ? styles.connectionCardActive : ''}`}>
                      <div className={styles.connectionCardHeader}>
                        <div className={styles.connectionIdentity}>
                          <span className={styles.statusDot} />
                          <div>
                            <div className={styles.connectionName}>{connection.name}</div>
                            <div className={styles.connectionMeta}>
                              {DB_TYPE_LABELS[connection.type]}
                              {connection.hideAllInitially ? ' - Hidden on load' : ''}
                            </div>
                          </div>
                        </div>
                        <div className={styles.connectionActions}>
                          <button className={`${styles.inlineButton} ${styles.inlineButtonPrimary}`} onClick={() => startEdit(connection)}>
                            <PencilLine size={13} strokeWidth={2.2} />
                            Edit
                          </button>
                          <button className={`${styles.inlineButton} ${styles.inlineButtonMuted}`} onClick={() => deleteMutation.mutate(connection.name)}>
                            <Trash2 size={13} strokeWidth={2.2} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className={styles.editorSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>{editingName ? 'Edit source' : 'Add source'}</div>
              <div className={styles.sectionMeta}>{editingName ? editingName : 'New connection'}</div>
            </div>

            {editingName !== null && (
              <div className={styles.editingBanner}>
                <div className={styles.editingText}>Editing "{editingName}"</div>
                <button className={styles.ghostButton} onClick={resetForm}>Cancel</button>
              </div>
            )}

            <div className={styles.form}>
              <div className={styles.segment}>
                {(['sqlserver', 'postgres', 'sqlite'] as DbType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setDbType(type)
                      setTestResult('idle')
                      setAvailableSchemas([])
                    }}
                    className={`${styles.segmentButton} ${dbType === type ? styles.segmentButtonActive : styles.segmentButtonIdle}`}
                  >
                    {DB_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              <div className={styles.fieldBlock}>
                <div className={styles.fieldLabel}>Connection name</div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Local Dev, Staging API, Analytics Replica..."
                  className={`${styles.input} ${editingName !== null ? styles.inputReadOnlyName : ''}`}
                />
              </div>

              <div className={styles.fieldBlock}>
                <div className={styles.fieldLabel}>Connection string</div>
                <input
                  value={connStr}
                  onChange={e => {
                    setConnStr(e.target.value)
                    setTestResult('idle')
                    setAvailableSchemas([])
                  }}
                  placeholder={CONN_STR_PLACEHOLDER[dbType]}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldBlock}>
                <div className={styles.fieldHeader}>
                  <div className={styles.fieldLabel}>Exclude schemas</div>
                  {availableSchemas.length > 0 && (
                    <div className={styles.fieldHint}>Click a schema chip to toggle exclusion</div>
                  )}
                </div>

                {availableSchemas.length > 0 && (
                  <div className={styles.schemaChips}>
                    {availableSchemas.map(schema => {
                      const excluded = excludedSchemas.includes(schema)
                      return (
                        <button
                          key={schema}
                          onClick={() => toggleAvailableSchema(schema)}
                          className={`${styles.schemaButton} ${excluded ? styles.schemaButtonActive : styles.schemaButtonIdle}`}
                        >
                          {schema}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className={styles.chipInputWrap} onClick={() => chipInputRef.current?.focus()}>
                  {excludedSchemas.map(schema => (
                    <span key={schema} className={styles.chip}>
                      {schema}
                      <button className={styles.chipRemove} onClick={e => { e.stopPropagation(); removeChip(schema) }}>
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    ref={chipInputRef}
                    value={chipInput}
                    onChange={e => setChipInput(e.target.value)}
                    onKeyDown={handleChipKeyDown}
                    placeholder={excludedSchemas.length === 0 ? 'Type a schema name and press space or enter...' : ''}
                    className={styles.chipInput}
                  />
                </div>
              </div>

              <div className={styles.fieldBlock}>
                <div className={styles.fieldHeader}>
                  <div className={styles.fieldLabel}>Included tables</div>
                  <div className={styles.fieldHint}>
                    {includedTables.length === 0 ? 'All tables load by default' : `${includedTables.length} selected`}
                  </div>
                </div>

                <div className={styles.tableRow}>
                  <button
                    onClick={handleLoadTables}
                    disabled={!connStr || loadingTables}
                    className={`${styles.secondaryButton} ${connStr ? '' : styles.secondaryButtonDisabled}`}
                  >
                    {loadingTables ? 'Loading tables...' : includedTables.length > 0 ? 'Edit table selection' : 'Choose tables'}
                  </button>
                  {includedTables.length > 0 && (
                    <button className={styles.ghostButton} onClick={() => setIncludedTables([])}>Clear</button>
                  )}
                </div>
              </div>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={hideAllInitially}
                  onChange={e => setHideAllInitially(e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>Hide all tables on first load</span>
              </label>

              {testResult !== 'idle' && (
                <div className={`${styles.testBanner} ${testResult === 'ok' ? styles.testBannerOk : styles.testBannerError}`}>
                  {testResult === 'ok' ? (
                    <>
                      <CheckCircle2 size={15} strokeWidth={2.2} />
                      Connection succeeded
                    </>
                  ) : (
                    <>
                      <XCircle size={15} strokeWidth={2.2} />
                      {testError}
                    </>
                  )}
                </div>
              )}

              <div className={styles.actionRow}>
                <button
                  onClick={handleTest}
                  disabled={!connStr}
                  className={`${styles.actionButton} ${styles.testButton} ${!connStr ? styles.actionButtonDisabled : ''} ${testResult === 'ok' ? styles.testButtonOk : ''} ${testResult === 'error' ? styles.testButtonError : ''}`}
                >
                  <Database size={14} strokeWidth={2.2} />
                  {testLabel}
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!name || !connStr || saveMutation.isPending}
                  className={`${styles.actionButton} ${styles.saveButton} ${name && connStr ? styles.saveButtonEnabled : styles.actionButtonDisabled}`}
                >
                  {saveMutation.isPending
                    ? (testResult === 'ok' ? (editingName ? 'Saving...' : 'Adding...') : 'Testing...')
                    : (
                      <>
                        <Plus size={14} strokeWidth={2.2} />
                        {editingName ? 'Save changes' : 'Add connection'}
                      </>
                    )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
