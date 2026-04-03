import { useState } from 'react'
import { FolderKanban, GitCompareArrows } from 'lucide-react'
import { useStore } from '../store'
import { ConnectionModal } from './ConnectionModal'
import type { Connection } from '../../types'

interface HeaderProps {
  connections: Connection[]
  currentWorkspaceName: string | null
  onRefresh: () => void
  onOpenWorkspaces: () => void
  onOpenDiff: () => void
}

function HeaderButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 13px',
        background: 'transparent',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-sm)',
        color: disabled ? 'var(--text-3)' : 'var(--text-1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function Header({
  connections,
  currentWorkspaceName,
  onRefresh,
  onOpenWorkspaces,
  onOpenDiff,
}: HeaderProps) {
  const { activeConnection, setActiveConnection } = useStore()
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <header style={{
        height: 54,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 14,
        zIndex: 20,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 14.5,
          fontWeight: 800,
          letterSpacing: -0.4,
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
          onChange={event => setActiveConnection(event.target.value)}
          style={{
            padding: '5px 11px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: activeConnection ? 'var(--text-1)' : 'var(--text-3)',
            background: 'var(--bg)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        >
          <option value="" disabled>Select connection...</option>
          <option value="__demo__" style={{ color: 'var(--sel)' }}>Demo Mode</option>
          {connections.map(connection => (
            <option key={connection.name} value={connection.name}>
              {connection.name}
            </option>
          ))}
        </select>

        {activeConnection && (
          <div style={{
            padding: '6px 10px',
            borderRadius: 999,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            fontSize: 12,
            color: currentWorkspaceName ? 'var(--accent)' : 'var(--text-3)',
            fontWeight: 600,
          }}>
            {currentWorkspaceName ? `Workspace: ${currentWorkspaceName}` : 'Ad hoc view'}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setActiveConnection('__demo__')}
            style={{
              padding: '7px 13px',
              background: 'transparent',
              border: '1px solid var(--sel)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--sel)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              opacity: activeConnection === '__demo__' ? 0.5 : 1,
            }}
          >
            Load Demo
          </button>
          <HeaderButton disabled={!activeConnection} onClick={onOpenWorkspaces}>
            <FolderKanban size={14} strokeWidth={2.2} />
            Workspaces
          </HeaderButton>
          <HeaderButton disabled={!activeConnection} onClick={onOpenDiff}>
            <GitCompareArrows size={14} strokeWidth={2.2} />
            Diff
          </HeaderButton>
          <button
            onClick={onRefresh}
            style={{
              padding: '7px 13px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 'var(--r-sm)',
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '7px 13px',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-1)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
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
