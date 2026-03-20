import { create } from 'zustand'
import type { CanvasElement, CanvasState } from '@/types'

interface HistoryEntry {
  elements: CanvasElement[]
}

interface EditorState {
  // Template
  templateId: string | null
  templateName: string
  setTemplateId: (id: string | null) => void
  setTemplateName: (name: string) => void

  // Canvas state
  canvas: CanvasState
  setCanvasSize: (width: number, height: number) => void

  // Elements
  selectedElementId: string | null
  selectElement: (id: string | null) => void
  addElement: (element: CanvasElement) => void
  updateElement: (id: string, updates: Partial<CanvasElement>) => void
  deleteElement: (id: string) => void
  duplicateElement: (id: string) => void
  moveElement: (id: string, x: number, y: number) => void
  resizeElement: (id: string, width: number, height: number) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void

  // Zoom & Pan
  zoom: number
  panX: number
  panY: number
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void

  // Grid
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  toggleGrid: () => void
  toggleSnap: () => void

  // History (undo/redo)
  history: HistoryEntry[]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Reset
  loadCanvas: (state: CanvasState) => void
  resetEditor: () => void
}

const DEFAULT_CANVAS: CanvasState = {
  elements: [],
  width: 50,
  height: 30,
  backgroundColor: '#FFFFFF',
}

export const useEditorStore = create<EditorState>((set, get) => ({
  templateId: null,
  templateName: 'Nueva Etiqueta',
  setTemplateId: (id) => set({ templateId: id }),
  setTemplateName: (name) => set({ templateName: name }),

  canvas: { ...DEFAULT_CANVAS },
  setCanvasSize: (width, height) =>
    set((s) => ({ canvas: { ...s.canvas, width, height } })),

  selectedElementId: null,
  selectElement: (id) => set({ selectedElementId: id }),

  addElement: (element) => {
    const state = get()
    state.pushHistory()
    set((s) => ({
      canvas: {
        ...s.canvas,
        elements: [...s.canvas.elements, element],
      },
      selectedElementId: element.id,
    }))
  },

  updateElement: (id, updates) =>
    set((s) => ({
      canvas: {
        ...s.canvas,
        elements: s.canvas.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ),
      },
    })),

  deleteElement: (id) => {
    const state = get()
    state.pushHistory()
    set((s) => ({
      canvas: {
        ...s.canvas,
        elements: s.canvas.elements.filter((el) => el.id !== id),
      },
      selectedElementId: s.selectedElementId === id ? null : s.selectedElementId,
    }))
  },

  duplicateElement: (id) => {
    const state = get()
    const element = state.canvas.elements.find((el) => el.id === id)
    if (!element) return
    state.pushHistory()
    const newElement: CanvasElement = {
      ...element,
      id: crypto.randomUUID(),
      x: element.x + 5,
      y: element.y + 5,
    }
    set((s) => ({
      canvas: {
        ...s.canvas,
        elements: [...s.canvas.elements, newElement],
      },
      selectedElementId: newElement.id,
    }))
  },

  moveElement: (id, x, y) => {
    const { snapToGrid, gridSize } = get()
    const snappedX = snapToGrid ? Math.round(x / gridSize) * gridSize : x
    const snappedY = snapToGrid ? Math.round(y / gridSize) * gridSize : y
    set((s) => ({
      canvas: {
        ...s.canvas,
        elements: s.canvas.elements.map((el) =>
          el.id === id ? { ...el, x: snappedX, y: snappedY } : el
        ),
      },
    }))
  },

  resizeElement: (id, width, height) =>
    set((s) => ({
      canvas: {
        ...s.canvas,
        elements: s.canvas.elements.map((el) =>
          el.id === id ? { ...el, width: Math.max(2, width), height: Math.max(2, height) } : el
        ),
      },
    })),

  bringToFront: (id) =>
    set((s) => {
      const maxZ = Math.max(...s.canvas.elements.map((el) => el.zIndex), 0)
      return {
        canvas: {
          ...s.canvas,
          elements: s.canvas.elements.map((el) =>
            el.id === id ? { ...el, zIndex: maxZ + 1 } : el
          ),
        },
      }
    }),

  sendToBack: (id) =>
    set((s) => {
      const minZ = Math.min(...s.canvas.elements.map((el) => el.zIndex), 0)
      return {
        canvas: {
          ...s.canvas,
          elements: s.canvas.elements.map((el) =>
            el.id === id ? { ...el, zIndex: minZ - 1 } : el
          ),
        },
      }
    }),

  zoom: 1,
  panX: 0,
  panY: 0,
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),

  showGrid: true,
  snapToGrid: true,
  gridSize: 2,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  history: [],
  historyIndex: -1,
  pushHistory: () =>
    set((s) => {
      const entry: HistoryEntry = {
        elements: JSON.parse(JSON.stringify(s.canvas.elements)),
      }
      const newHistory = s.history.slice(0, s.historyIndex + 1)
      newHistory.push(entry)
      if (newHistory.length > 50) newHistory.shift()
      return { history: newHistory, historyIndex: newHistory.length - 1 }
    }),

  undo: () =>
    set((s) => {
      if (s.historyIndex < 0) return s
      const entry = s.history[s.historyIndex]
      return {
        canvas: { ...s.canvas, elements: entry.elements },
        historyIndex: s.historyIndex - 1,
        selectedElementId: null,
      }
    }),

  redo: () =>
    set((s) => {
      if (s.historyIndex >= s.history.length - 1) return s
      const entry = s.history[s.historyIndex + 1]
      return {
        canvas: { ...s.canvas, elements: entry.elements },
        historyIndex: s.historyIndex + 1,
        selectedElementId: null,
      }
    }),

  loadCanvas: (state) =>
    set({
      canvas: state,
      selectedElementId: null,
      history: [],
      historyIndex: -1,
      zoom: 1,
      panX: 0,
      panY: 0,
    }),

  resetEditor: () =>
    set({
      templateId: null,
      templateName: 'Nueva Etiqueta',
      canvas: { ...DEFAULT_CANVAS },
      selectedElementId: null,
      history: [],
      historyIndex: -1,
      zoom: 1,
      panX: 0,
      panY: 0,
    }),
}))
