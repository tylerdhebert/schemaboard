import { create } from 'zustand'

interface AppState {
  activeConnection: string | null
  selectedTables: Set<string>
  hiddenGroups: Set<string>
  autoExpand: boolean
  format: 'condensed' | 'ddl'
  zoomToTable: string | null
  setActiveConnection: (name: string) => void
  toggleTable: (id: string) => void
  selectTables: (ids: string[]) => void
  clearSelection: () => void
  toggleGroupVisibility: (groupId: string) => void
  setAutoExpand: (v: boolean) => void
  setFormat: (f: 'condensed' | 'ddl') => void
  setZoomToTable: (id: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  activeConnection: null,
  selectedTables: new Set(),
  hiddenGroups: new Set(),
  autoExpand: true,
  format: 'condensed',
  zoomToTable: null,

  setActiveConnection: (name) => set({ activeConnection: name, selectedTables: new Set() }),

  toggleTable: (id) => set((s) => {
    const next = new Set(s.selectedTables)
    next.has(id) ? next.delete(id) : next.add(id)
    return { selectedTables: next }
  }),

  selectTables: (ids) => set((s) => {
    const next = new Set(s.selectedTables)
    ids.forEach(id => next.add(id))
    return { selectedTables: next }
  }),

  clearSelection: () => set({ selectedTables: new Set() }),

  toggleGroupVisibility: (groupId) => set((s) => {
    const next = new Set(s.hiddenGroups)
    next.has(groupId) ? next.delete(groupId) : next.add(groupId)
    return { hiddenGroups: next }
  }),

  setAutoExpand: (autoExpand) => set({ autoExpand }),
  setFormat: (format) => set({ format }),
  setZoomToTable: (zoomToTable) => set({ zoomToTable }),
}))
