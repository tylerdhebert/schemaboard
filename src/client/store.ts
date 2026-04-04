import { create } from 'zustand'
import type { ContextFormat, LayoutType, TablePosition, WorkspaceState } from '../types'

type AppMode = 'live' | 'demo'

interface AppState {
  appMode: AppMode
  activeConnection: string | null
  activeWorkspaceId: string | null
  selectedTables: Set<string>
  hiddenGroups: Set<string>
  hiddenTables: Set<string>
  tablePositions: Record<string, TablePosition>
  format: ContextFormat
  zoomToTable: string | null
  fitToNodes: string[] | null
  fitViewKey: number
  layoutKey: number
  layoutType: LayoutType
  searchQuery: string
  compactNodes: boolean
  setActiveConnection: (name: string | null) => void
  setDemoMode: (enabled: boolean) => void
  setActiveWorkspaceId: (id: string | null) => void
  applyWorkspaceState: (state: WorkspaceState, workspaceId: string | null) => void
  captureWorkspaceState: () => WorkspaceState
  toggleTable: (id: string) => void
  selectTables: (ids: string[]) => void
  deselectTables: (ids: string[]) => void
  clearSelection: () => void
  toggleGroupVisibility: (groupId: string) => void
  toggleTableVisibility: (id: string) => void
  setHiddenTables: (ids: string[]) => void
  setFormat: (f: ContextFormat) => void
  setZoomToTable: (id: string | null) => void
  setFitToNodes: (ids: string[] | null) => void
  triggerFitView: () => void
  resetLayout: () => void
  setLayoutType: (t: LayoutType) => void
  setSearchQuery: (q: string) => void
  toggleCompactNodes: () => void
  setTablePosition: (id: string, position: TablePosition) => void
}

function sortObjectEntries<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  )
}

export function normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
  return {
    selectedTables: [...state.selectedTables].sort(),
    hiddenGroups: [...state.hiddenGroups].sort(),
    hiddenTables: [...state.hiddenTables].sort(),
    format: state.format,
    layoutType: state.layoutType,
    compactNodes: state.compactNodes,
    tablePositions: sortObjectEntries(state.tablePositions),
  }
}

export function workspaceStatesEqual(left: WorkspaceState, right: WorkspaceState): boolean {
  return JSON.stringify(normalizeWorkspaceState(left)) === JSON.stringify(normalizeWorkspaceState(right))
}

export const useStore = create<AppState>((set, get) => ({
  appMode: 'live',
  activeConnection: null,
  activeWorkspaceId: null,
  selectedTables: new Set(),
  hiddenGroups: new Set(),
  hiddenTables: new Set(),
  tablePositions: {},
  format: 'condensed',
  zoomToTable: null,
  fitToNodes: null,
  fitViewKey: 0,
  layoutKey: 0,
  layoutType: 'dagre',
  searchQuery: '',
  compactNodes: false,

  setActiveConnection: (name) => set((state) => ({
    appMode: 'live',
    activeConnection: name,
    activeWorkspaceId: null,
    selectedTables: new Set(),
    hiddenGroups: new Set(),
    hiddenTables: new Set(),
    tablePositions: {},
    zoomToTable: null,
    fitToNodes: null,
    searchQuery: '',
    fitViewKey: state.fitViewKey + 1,
  })),

  setDemoMode: (enabled) => set((state) => ({
    appMode: enabled ? 'demo' : 'live',
    activeConnection: enabled ? null : state.activeConnection,
    activeWorkspaceId: null,
    selectedTables: new Set(),
    hiddenGroups: new Set(),
    hiddenTables: new Set(),
    tablePositions: {},
    zoomToTable: null,
    fitToNodes: null,
    searchQuery: '',
    fitViewKey: state.fitViewKey + 1,
  })),

  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),

  applyWorkspaceState: (workspaceState, workspaceId) => set((state) => ({
    activeWorkspaceId: workspaceId,
    selectedTables: new Set(workspaceState.selectedTables),
    hiddenGroups: new Set(workspaceState.hiddenGroups),
    hiddenTables: new Set(workspaceState.hiddenTables),
    tablePositions: { ...workspaceState.tablePositions },
    format: workspaceState.format,
    layoutType: workspaceState.layoutType,
    compactNodes: workspaceState.compactNodes,
    zoomToTable: null,
    fitToNodes: null,
    fitViewKey: state.fitViewKey + 1,
  })),

  captureWorkspaceState: () => {
    const state = get()
    return {
      selectedTables: [...state.selectedTables],
      hiddenGroups: [...state.hiddenGroups],
      hiddenTables: [...state.hiddenTables],
      format: state.format,
      layoutType: state.layoutType,
      compactNodes: state.compactNodes,
      tablePositions: { ...state.tablePositions },
    }
  },

  toggleTable: (id) => set((state) => {
    const next = new Set(state.selectedTables)
    next.has(id) ? next.delete(id) : next.add(id)
    return { selectedTables: next }
  }),

  selectTables: (ids) => set((state) => {
    const next = new Set(state.selectedTables)
    ids.forEach(id => next.add(id))
    return { selectedTables: next }
  }),

  deselectTables: (ids) => set((state) => {
    const next = new Set(state.selectedTables)
    ids.forEach(id => next.delete(id))
    return { selectedTables: next }
  }),

  clearSelection: () => set({ selectedTables: new Set() }),

  toggleGroupVisibility: (groupId) => set((state) => {
    const next = new Set(state.hiddenGroups)
    next.has(groupId) ? next.delete(groupId) : next.add(groupId)
    return { hiddenGroups: next }
  }),

  toggleTableVisibility: (id) => set((state) => {
    const next = new Set(state.hiddenTables)
    next.has(id) ? next.delete(id) : next.add(id)
    return { hiddenTables: next }
  }),

  setHiddenTables: (ids) => set({ hiddenTables: new Set(ids) }),

  setFormat: (format) => set({ format }),
  setZoomToTable: (zoomToTable) => set({ zoomToTable }),
  setFitToNodes: (fitToNodes) => set({ fitToNodes }),
  triggerFitView: () => set((state) => ({ fitViewKey: state.fitViewKey + 1 })),
  resetLayout: () => set((state) => ({
    layoutKey: state.layoutKey + 1,
    tablePositions: {},
  })),
  setLayoutType: (layoutType) => set({ layoutType }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleCompactNodes: () => set((state) => ({ compactNodes: !state.compactNodes })),
  setTablePosition: (id, position) => set((state) => ({
    tablePositions: {
      ...state.tablePositions,
      [id]: position,
    },
  })),
}))
