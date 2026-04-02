import { useState } from 'react'
import { useStore } from '../store'
import { ConnectionModal } from './ConnectionModal'
import type { Connection } from '../../types'

interface HeaderProps {
  connections: Connection[]
  onRefresh: () => void
}

export function Header({ connections, onRefresh }: HeaderProps) {
  const { activeConnection, setActiveConnection } = useStore()
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <header style={{
        height: 54, background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 18px', gap: 14, zIndex: 20, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 14.5, fontWeight: 800, letterSpacing: -0.4,
          background: 'var(--accent-grad)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          schemaboard
        </span>

        <div style={{ width: 1, height: 18, background: 'var(--border-strong)', flexShrink: 0 }} />

        <select
          value={activeConnection ?? ''}
          onChange={e => setActiveConnection(e.target.value)}
          style={{
            padding: '5px 11px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: activeConnection ? 'var(--text-1)' : 'var(--text-3)',
            background: 'var(--bg)', fontFamily: 'inherit', outline: 'none',
          }}
        >
          <option value="" disabled>Select connection…</option>
          <option value="__demo__" style={{ color: 'var(--sel)' }}>Demo Mode</option>
          {connections.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setActiveConnection('__demo__')}
            style={{
              padding: '7px 13px', background: 'transparent',
              border: `1px solid var(--sel)`,
              borderRadius: 'var(--r-sm)',
              color: 'var(--sel)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
              opacity: activeConnection === '__demo__' ? 0.5 : 1,
            }}
          >
            Load Demo
          </button>
          <button
            onClick={onRefresh}
            style={{
              padding: '7px 13px', background: 'transparent', border: 'none',
              color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '7px 13px', background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)', color: 'var(--text-1)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Manage Connections
          </button>
        </div>
      </header>

      {showModal && (
        <ConnectionModal
          connections={connections}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
