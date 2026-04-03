import { useState, useEffect, useRef } from 'react'

interface TablePickerProps {
  tables: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  onClose: () => void
  title?: string
}

export function TablePicker({ tables, selected, onChange, onClose, title = 'Choose tables' }: TablePickerProps) {
  const [search, setSearch] = useState('')
  const [localSelected, setLocalSelected] = useState(() => new Set(selected))
  const dragging = useRef(false)
  const dragValue = useRef(true)

  const filtered = search
    ? tables.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : tables

  const allFiltered = filtered.length > 0 && filtered.every(t => localSelected.has(t))

  useEffect(() => {
    const onUp = () => { dragging.current = false }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const startDrag = (table: string) => {
    dragging.current = true
    dragValue.current = !localSelected.has(table)
    setLocalSelected(prev => {
      const next = new Set(prev)
      dragValue.current ? next.add(table) : next.delete(table)
      return next
    })
  }

  const onRowEnter = (table: string) => {
    if (!dragging.current) return
    setLocalSelected(prev => {
      const next = new Set(prev)
      dragValue.current ? next.add(table) : next.delete(table)
      return next
    })
  }

  const toggleAll = () => {
    if (allFiltered) {
      setLocalSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.delete(t)); return n })
    } else {
      setLocalSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.add(t)); return n })
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 'var(--r)',
          border: '1px solid var(--border)', width: 440, maxHeight: '72vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>
            {title}
          </div>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tables…"
            style={{
              width: '100%', padding: '7px 10px', boxSizing: 'border-box',
              border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
              fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text-1)',
              background: 'var(--bg)', outline: 'none',
            }}
          />
        </div>

        {/* Select all row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 18px', borderBottom: '1px solid var(--border)',
            cursor: 'pointer', userSelect: 'none',
          }}
          onClick={toggleAll}
        >
          <input type="checkbox" checked={allFiltered} onChange={() => {}} style={{ cursor: 'pointer' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>
            {allFiltered ? 'Deselect all' : 'Select all'} ({filtered.length})
          </span>
        </div>

        {/* Table list */}
        <div style={{ flex: 1, overflowY: 'auto', userSelect: 'none' }}>
          {filtered.map(table => {
            const isSel = localSelected.has(table)
            return (
              <div
                key={table}
                onMouseDown={() => startDrag(table)}
                onMouseEnter={() => onRowEnter(table)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 18px', cursor: 'pointer',
                  background: isSel ? 'var(--sel-light)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => {}}
                  style={{ pointerEvents: 'none' }}
                />
                <span style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 500 }}>
                  {table}
                </span>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-3)' }}>
              No tables match "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {localSelected.size} of {tables.length} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-strong)', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'none', color: 'var(--text-2)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onChange([...localSelected]); onClose() }}
              style={{
                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                border: 'none', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'var(--accent-grad)', color: 'white',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
