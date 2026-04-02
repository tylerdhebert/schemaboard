import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Group } from '../../types'

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
]

interface GroupModalProps {
  groups: Group[]
  onClose: () => void
}

export function GroupModal({ groups, onClose }: GroupModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const qc = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.groups.post({ name, color, tables: [] })
      if (res.error) throw res.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setName('')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.groups({ id }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] })
  })

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
          border: '1px solid var(--border)', padding: 24, width: 380,
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)' }}>
          Manage Groups
        </h2>

        {groups.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            No groups yet. Create one below to organize your schema.
          </p>
        )}

        {groups.map(g => (
          <div key={g.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              width: 9, height: 9, borderRadius: 3,
              background: g.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
              {g.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {g.tables.length} table{g.tables.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => deleteMutation.mutate(g.id)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-3)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}
            >
              Remove
            </button>
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name (e.g. Orders)"
            style={{
              padding: '8px 12px', background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)', color: 'var(--text-1)',
              fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%',
            }}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: c, cursor: 'pointer',
                  outline: color === c ? '2px solid white' : 'none',
                  outlineOffset: 2,
                  transition: 'outline 0.1s',
                }}
              />
            ))}
          </div>

          <button
            onClick={() => addMutation.mutate()}
            disabled={!name || addMutation.isPending}
            style={{
              padding: '8px 14px', borderRadius: 'var(--r-sm)',
              background: name ? 'var(--accent-grad)' : 'rgba(255,255,255,0.1)',
              border: 'none', color: 'white',
              cursor: name ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            }}
          >
            {addMutation.isPending ? 'Adding…' : 'Add Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
