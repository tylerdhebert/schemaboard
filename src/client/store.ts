import { create } from 'zustand'
import type { LayoutType } from '../types'

interface AppState {
  activeConnection: string | null
  selectedTables: Set<string>
  hiddenGroups: Set<string>
  hiddenTables: Set<string>
  autoExpand: boolean
  format: 'condensed' | 'ddl'
  zoomToTable: string | null
  layoutKey: number
  layoutType: LayoutType
  searchQuery: string
  setActiveConnection: (name: string) => void
  toggleTable: (id: string) => void
  selectTables: (ids: string[]) => void
  clearSelection: () => void
  toggleGroupVisibility: (groupId: string) => void
  toggleTableVisibility: (id: string) => void
  setHiddenTables: (ids: string[]) => void
  setAutoExpand: (v: boolean) => void
  setFormat: (f: 'condensed' | 'ddl') => void
  setZoomToTable: (id: string | null) => void
  resetLayout: () => void
  setLayoutType: (t: LayoutType) => void
  setSearchQuery: (q: string) => void
}

export const useStore = create<AppState>((set) => ({
  activeConnection: null,
  selectedTables: new Set(),
  hiddenGroups: new Set(),
  hiddenTables: new Set(),
  autoExpand: true,
  format: 'condensed',
  zoomToTable: null,
  layoutKey: 0,
  layoutType: 'dagre',
  searchQuery: '',

  setActiveConnection: (name) => set({ activeConnection: name, selectedTables: new Set(), hiddenTables: new Set() }),

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

  toggleTableVisibility: (id) => set((s) => {
    const next = new Set(s.hiddenTables)
    next.has(id) ? next.delete(id) : next.add(id)
    return { hiddenTables: next }
  }),

  setHiddenTables: (ids) => set({ hiddenTables: new Set(ids) }),

  setAutoExpand: (autoExpand) => set({ autoExpand }),
  setFormat: (format) => set({ format }),
  setZoomToTable: (zoomToTable) => set({ zoomToTable }),
  resetLayout: () => set((s) => ({ layoutKey: s.layoutKey + 1 })),
  setLayoutType: (layoutType) => set({ layoutType }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}))
