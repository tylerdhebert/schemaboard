import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useStore } from '../store'
import type { Workspace } from '../../types'

interface WorkspaceModalProps {
  activeConnection: string
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  onLoadWorkspace: (workspace: Workspace) => void
  onClose: () => void
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function readRouteError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'value' in error) {
    const value = (error as { value?: { error?: string } }).value
    if (value?.error) return value.error
  }

  if (error instanceof Error) return error.message
  return fallback
}

export function WorkspaceModal({
  activeConnection,
  workspaces,
  activeWorkspaceId,
  onLoadWorkspace,
  onClose,
}: WorkspaceModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()
  const activeWorkspace = useMemo(
    () => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  )

  useEffect(() => {
    setName(activeWorkspace?.name ?? '')
  }, [activeWorkspace])

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.workspaces.post({
        connectionName: activeConnection,
        name,
        state: useStore.getState().captureWorkspaceState(),
      })

      if (res.error) {
        throw res.error
      }

      return res.data as Workspace
    },
    onSuccess: (workspace) => {
      setError('')
      qc.invalidateQueries({ queryKey: ['workspaces', activeConnection] })
      onLoadWorkspace(workspace)
      onClose()
    },
    onError: (mutationError) => {
      setError(readRouteError(mutationError, 'Failed to save workspace'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId) throw new Error('No workspace selected')

      const res = await api.api.workspaces({ id: activeWorkspaceId }).put({
        name,
        state: useStore.getState().captureWorkspaceState(),
      })

      if (res.error) {
        throw res.error
      }

      return res.data as Workspace
    },
    onSuccess: (workspace) => {
      setError('')
      qc.invalidateQueries({ queryKey: ['workspaces', activeConnection] })
      onLoadWorkspace(workspace)
      onClose()
    },
    onError: (mutationError) => {
      setError(readRouteError(mutationError, 'Failed to update workspace'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await api.api.workspaces({ id: workspaceId }).delete()
      if (res.error) throw res.error
      return workspaceId
    },
    onSuccess: (workspaceId) => {
      setError('')
      qc.invalidateQueries({ queryKey: ['workspaces', activeConnection] })
      if (workspaceId === activeWorkspaceId) {
        useStore.getState().setActiveWorkspaceId(null)
      }
    },
    onError: (mutationError) => {
      setError(readRouteError(mutationError, 'Failed to delete workspace'))
    },
  })

  const loading = createMutation.isPending || updateMutation.isPending

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: 'var(--shadow-lg)',
          padding: 22,
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Saved Workspaces</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
              {activeConnection === '__demo__' ? 'Demo Mode' : activeConnection}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-3)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
          {workspaces.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-3)' }}>
              No saved workspaces yet. Save the current view below.
            </div>
          ) : (
            workspaces.map(workspace => {
              const active = workspace.id === activeWorkspaceId
              return (
                <div
                  key={workspace.id}
                  style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid var(--border)',
                    background: active ? 'var(--accent-light)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-1)' }}>
                      {workspace.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Updated {formatDate(workspace.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setError('')
                      onLoadWorkspace(workspace)
                      onClose()
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(workspace.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                    }}
                  >
                    Delete
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Save current view
          </div>
          {activeWorkspace && (
            <div style={{ fontSize: 12, color: 'var(--accent)' }}>
              Loaded workspace: {activeWorkspace.name}
            </div>
          )}
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Workspace name"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg)',
              color: 'var(--text-1)',
              fontFamily: 'inherit',
              fontSize: 13,
              outline: 'none',
            }}
          />
          {error && (
            <div style={{
              fontSize: 12,
              color: 'var(--err-color)',
              padding: '7px 10px',
              borderRadius: 6,
              background: 'var(--err-bg)',
            }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name || loading}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg)',
                color: name ? 'var(--text-1)' : 'var(--text-3)',
                cursor: name ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {createMutation.isPending ? 'Saving...' : 'Save as new'}
            </button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={!activeWorkspaceId || !name || loading}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: activeWorkspaceId && name ? 'var(--accent-grad)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: activeWorkspaceId && name ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update current'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
