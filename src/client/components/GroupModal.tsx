import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Group } from '../../types'
import styles from './GroupModal.module.css'

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
]

interface GroupModalProps {
  groups: Group[]
  initialTableName?: string | null
  initialTableNames?: string[] | null
  editGroupId?: string | null
  onClose: () => void
}

export function GroupModal({
  groups,
  initialTableName = null,
  initialTableNames = null,
  editGroupId = null,
  onClose,
}: GroupModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [editingGroupId, setEditingGroupId] = useState<string | null>(editGroupId)
  const qc = useQueryClient()

  const editingGroup = useMemo(
    () => groups.find(group => group.id === editingGroupId) ?? null,
    [groups, editingGroupId]
  )
  const pendingTableNames = useMemo(
    () => initialTableNames?.length ? initialTableNames : (initialTableName ? [initialTableName] : []),
    [initialTableNames, initialTableName]
  )

  useEffect(() => {
    setEditingGroupId(editGroupId)
  }, [editGroupId])

  useEffect(() => {
    if (!editingGroup) return
    setName(editingGroup.name)
    setColor(editingGroup.color)
  }, [editingGroup])

  function resetForm() {
    setEditingGroupId(null)
    setName('')
    setColor(PRESET_COLORS[0])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingGroupId) {
        const res = await api.api.groups({ id: editingGroupId }).put({ name, color })
        if (res.error) throw res.error
        return
      }

      const res = await api.api.groups.post({
        name,
        color,
        tables: pendingTableNames,
      })
      if (res.error) throw res.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      if (editingGroupId) {
        resetForm()
        return
      }
      if (pendingTableNames.length > 0) {
        onClose()
        return
      }
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.groups({ id }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      if (editingGroupId) resetForm()
    },
  })

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Manage Groups</h2>
            <div className={styles.subtitle}>Organize tables into named clusters for faster navigation and exports.</div>
          </div>
        </div>

        {pendingTableNames.length > 0 && !editingGroupId && (
          <p className={styles.note}>
            {pendingTableNames.length === 1
              ? `Creating a group will add \`${pendingTableNames[0]}\` to it.`
              : `Creating a group will add ${pendingTableNames.length} selected tables to it.`}
          </p>
        )}

        <div className={styles.groupList}>
          {groups.length === 0 ? (
            <p className={styles.emptyText}>No groups yet. Create one below to organize your schema.</p>
          ) : (
            groups.map(group => (
              <div key={group.id} className={`${styles.groupRow} ${editingGroupId === group.id ? styles.groupRowActive : ''}`}>
                <div className={styles.groupIdentity}>
                  <div className={styles.swatch} style={{ background: group.color }} />
                  <div className={styles.groupMeta}>
                    <span className={styles.groupName}>{group.name}</span>
                    <span className={styles.groupCount}>{group.tables.length} table{group.tables.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className={styles.groupActions}>
                  <button
                    className={`${styles.inlineButton} ${styles.inlineButtonPrimary}`}
                    onClick={() => {
                      setEditingGroupId(group.id)
                      setName(group.name)
                      setColor(group.color)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={`${styles.inlineButton} ${styles.inlineButtonMuted}`}
                    onClick={() => deleteMutation.mutate(group.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.form}>
          <div className={styles.formHeader}>
            <div className={styles.formTitle}>{editingGroupId ? 'Edit group' : 'Create group'}</div>
            <div className={styles.formMeta}>{editingGroupId ? 'Rename or recolor the current group' : 'Give the group a clear name and accent color'}</div>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={editingGroupId ? 'Edit group name' : 'Group name (e.g. Orders)'}
            className={styles.nameInput}
          />

          <div className={styles.swatchRow}>
            {PRESET_COLORS.map(swatch => (
              <div
                key={swatch}
                onClick={() => setColor(swatch)}
                className={`${styles.swatchButton} ${color === swatch ? styles.swatchButtonActive : ''}`}
                style={{ background: swatch }}
              />
            ))}
          </div>

          <div className={styles.actionRow}>
            {editingGroupId && (
              <button className={styles.cancelButton} onClick={resetForm}>Cancel</button>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!name || saveMutation.isPending}
              className={styles.saveButton}
              style={{
                background: name ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                cursor: name ? 'pointer' : 'not-allowed',
              }}
            >
              {saveMutation.isPending
                ? (editingGroupId ? 'Saving...' : 'Adding...')
                : (editingGroupId ? 'Save Group' : 'Add Group')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
