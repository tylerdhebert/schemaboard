import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useStore } from '../store'
import type { Workspace } from '../../types'
import styles from './WorkspaceModal.module.css'

interface WorkspaceModalProps {
  activeConnection: string
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  defaultDraftName?: string
  defaultAction?: 'create' | 'update'
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
  defaultDraftName,
  defaultAction = 'update',
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

  function upsertWorkspaceCache(workspace: Workspace) {
    qc.setQueryData(['workspaces', activeConnection], (current: Workspace[] | undefined) => {
      const items = current ?? []
      const existingIndex = items.findIndex(item => item.id === workspace.id)

      if (existingIndex === -1) {
        return [...items, workspace]
      }

      return items.map(item => item.id === workspace.id ? workspace : item)
    })
  }

  useEffect(() => {
    if (defaultAction === 'create') {
      setName(defaultDraftName ?? '')
      return
    }

    setName(activeWorkspace?.name ?? defaultDraftName ?? '')
  }, [activeWorkspace, defaultAction, defaultDraftName])

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
      upsertWorkspaceCache(workspace)
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
      upsertWorkspaceCache(workspace)
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
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Saved Workspaces</div>
            <div className={styles.subtitle}>
              {activeConnection === '__demo__' ? 'Sample schema' : activeConnection}
            </div>
          </div>
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>

        <div className={styles.workspaceList}>
          {workspaces.length === 0 ? (
            <div className={styles.workspaceEmpty}>
              No saved workspaces yet. Save the current view below.
            </div>
          ) : (
            workspaces.map(workspace => {
              const active = workspace.id === activeWorkspaceId
              return (
                <div
                  key={workspace.id}
                  className={`${styles.workspaceRow} ${active ? styles.workspaceRowActive : ''}`}
                >
                  <div className={styles.workspaceMeta}>
                    <div className={`${styles.workspaceName} ${active ? styles.workspaceNameActive : ''}`}>
                      {workspace.name}
                    </div>
                    <div className={styles.workspaceTimestamp}>
                      Updated {formatDate(workspace.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setError('')
                      onLoadWorkspace(workspace)
                      onClose()
                    }}
                    className={`${styles.inlineButton} ${styles.loadButton}`}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(workspace.id)}
                    className={`${styles.inlineButton} ${styles.deleteButton}`}
                  >
                    Delete
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionLabel}>
            {defaultAction === 'create' ? 'Save as new workspace' : 'Save current view'}
          </div>
          {activeWorkspace && (
            <div className={styles.loadedWorkspace}>
              Loaded workspace: {activeWorkspace.name}
            </div>
          )}
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Workspace name"
            className={styles.nameInput}
          />
          {error && (
            <div className={styles.error}>{error}</div>
          )}
          <div className={styles.actionRow}>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name || loading}
              className={`${styles.secondaryAction} ${name ? '' : styles.secondaryActionDisabled}`}
            >
              {createMutation.isPending ? 'Saving...' : 'Save as new'}
            </button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={!activeWorkspaceId || !name || loading}
              className={`${styles.primaryAction} ${activeWorkspaceId && name ? styles.primaryActionEnabled : styles.primaryActionDisabled}`}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update current'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
