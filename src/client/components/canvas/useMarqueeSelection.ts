import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Node, Viewport } from '@xyflow/react'

type MarqueeSelection = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

function getNodeBox(node: Node & { measured?: { width?: number; height?: number } }) {
  const width = node.measured?.width ?? 220
  const height = node.measured?.height ?? 80
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + width,
    bottom: node.position.y + height,
  }
}

interface UseMarqueeSelectionProps {
  canvasRef: React.RefObject<HTMLDivElement | null>
  rfNodes: Node[]
  selectTables: (ids: string[]) => void
  clearSelection: () => void
}

export function useMarqueeSelection({
  canvasRef,
  rfNodes,
  selectTables,
  clearSelection,
}: UseMarqueeSelectionProps) {
  const [marqueeSelection, setMarqueeSelection] = useState<MarqueeSelection | null>(null)
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 })
  const marqueeStateRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const suppressContextMenuRef = useRef(false)

  const finishMarqueeSelection = useCallback((selection: MarqueeSelection | null) => {
    marqueeStateRef.current = null
    setMarqueeSelection(null)
    if (!selection) return

    const { x, y, zoom } = viewportRef.current
    const left = Math.min(selection.startX, selection.currentX)
    const top = Math.min(selection.startY, selection.currentY)
    const right = Math.max(selection.startX, selection.currentX)
    const bottom = Math.max(selection.startY, selection.currentY)
    const width = right - left
    const height = bottom - top

    if (width < 6 || height < 6) return

    const flowLeft = (left - x) / zoom
    const flowTop = (top - y) / zoom
    const flowRight = (right - x) / zoom
    const flowBottom = (bottom - y) / zoom

    const selectedIds = rfNodes
      .filter(node => {
        const box = getNodeBox(node as Node & { measured?: { width?: number; height?: number } })
        return !(
          box.right < flowLeft ||
          box.left > flowRight ||
          box.bottom < flowTop ||
          box.top > flowBottom
        )
      })
      .map(node => node.id)

    clearSelection()
    if (selectedIds.length > 0) {
      selectTables(selectedIds)
    }
  }, [clearSelection, rfNodes, selectTables])

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const marqueeState = marqueeStateRef.current
      const canvas = canvasRef.current
      if (!marqueeState || !canvas) return

      const rect = canvas.getBoundingClientRect()
      const nextX = event.clientX - rect.left
      const nextY = event.clientY - rect.top
      const moved = Math.abs(nextX - marqueeState.startX) > 4 || Math.abs(nextY - marqueeState.startY) > 4
      marqueeStateRef.current = { ...marqueeState, moved: marqueeState.moved || moved }
      if (moved) suppressContextMenuRef.current = true

      setMarqueeSelection({
        startX: marqueeState.startX,
        startY: marqueeState.startY,
        currentX: nextX,
        currentY: nextY,
      })
    }

    function handlePointerUp() {
      finishMarqueeSelection(marqueeSelection)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [canvasRef, finishMarqueeSelection, marqueeSelection])

  const marqueeBox = useMemo(() => (
    marqueeSelection ? {
      left: Math.min(marqueeSelection.startX, marqueeSelection.currentX),
      top: Math.min(marqueeSelection.startY, marqueeSelection.currentY),
      width: Math.abs(marqueeSelection.currentX - marqueeSelection.startX),
      height: Math.abs(marqueeSelection.currentY - marqueeSelection.startY),
    } : null
  ), [marqueeSelection])

  const beginMarqueeSelection = useCallback((event: React.MouseEvent<HTMLDivElement>, controlsClassName: string) => {
    if (event.button !== 2 || !canvasRef.current) return

    const target = event.target as HTMLElement
    if (target.closest('[data-table-id]') || target.closest(`.${controlsClassName}`)) return

    event.preventDefault()
    event.stopPropagation()

    const rect = canvasRef.current.getBoundingClientRect()
    const startX = event.clientX - rect.left
    const startY = event.clientY - rect.top
    marqueeStateRef.current = { startX, startY, moved: false }
    setMarqueeSelection({ startX, startY, currentX: startX, currentY: startY })
  }, [canvasRef])

  const handleContextMenuCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const target = event.target as HTMLElement
    if (!target.closest('[data-table-id]')) {
      event.preventDefault()
    }
  }, [])

  return {
    marqueeSelection,
    marqueeBox,
    viewportRef,
    beginMarqueeSelection,
    handleContextMenuCapture,
  }
}
