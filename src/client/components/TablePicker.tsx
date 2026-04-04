import { useEffect, useRef, useState } from 'react'
import styles from './TablePicker.module.css'

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
    ? tables.filter(table => table.toLowerCase().includes(search.toLowerCase()))
    : tables

  const allFiltered = filtered.length > 0 && filtered.every(table => localSelected.has(table))

  useEffect(() => {
    const onUp = () => { dragging.current = false }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  function startDrag(table: string) {
    dragging.current = true
    dragValue.current = !localSelected.has(table)
    setLocalSelected(prev => {
      const next = new Set(prev)
      dragValue.current ? next.add(table) : next.delete(table)
      return next
    })
  }

  function onRowEnter(table: string) {
    if (!dragging.current) return
    setLocalSelected(prev => {
      const next = new Set(prev)
      dragValue.current ? next.add(table) : next.delete(table)
      return next
    })
  }

  function toggleAll() {
    if (allFiltered) {
      setLocalSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(table => next.delete(table))
        return next
      })
      return
    }

    setLocalSelected(prev => {
      const next = new Set(prev)
      filtered.forEach(table => next.add(table))
      return next
    })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={event => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <input
            autoFocus
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search tables..."
            className={styles.searchInput}
          />
        </div>

        <div className={styles.selectAllRow} onClick={toggleAll}>
          <input type="checkbox" checked={allFiltered} onChange={() => {}} className={styles.checkbox} />
          <span className={styles.selectAllLabel}>
            {allFiltered ? 'Deselect all' : 'Select all'} ({filtered.length})
          </span>
        </div>

        <div className={styles.list}>
          {filtered.map(table => {
            const isSelected = localSelected.has(table)
            return (
              <div
                key={table}
                onMouseDown={() => startDrag(table)}
                onMouseEnter={() => onRowEnter(table)}
                className={`${styles.tableRow} ${isSelected ? styles.tableRowSelected : ''}`}
              >
                <input type="checkbox" checked={isSelected} onChange={() => {}} className={`${styles.checkbox} ${styles.rowCheckbox}`} />
                <span className={styles.rowLabel}>{table}</span>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className={styles.empty}>No tables match "{search}"</div>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerLabel}>{localSelected.size} of {tables.length} selected</span>
          <div className={styles.footerActions}>
            <button onClick={onClose} className={`${styles.button} ${styles.cancelButton}`}>Cancel</button>
            <button
              onClick={() => {
                onChange([...localSelected])
                onClose()
              }}
              className={`${styles.button} ${styles.applyButton}`}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
