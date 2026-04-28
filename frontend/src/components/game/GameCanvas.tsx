'use client'

import { useRef, useEffect, useState } from 'react'
import Konva from 'konva'
import { useGameStore } from '@/store/gameStore'
import { useAuthStore } from '@/store/authStore'

interface Props {
  sendMessage: (type: string, payload?: unknown) => void
}

const DISPOSITION_COLOR: Record<string, string> = {
  friendly: '#a88c52',
  neutral: '#5d6d7e',
  hostile: '#c0392b',
}

export default function GameCanvas({ sendMessage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const layersRef = useRef<{
    map: Konva.Layer
    grid: Konva.Layer
    fog: Konva.Layer
    tokens: Konva.Layer
    ruler: Konva.Layer
  } | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })

  const myUserId = useAuthStore((s) => s.user?.id)
  const tokens = useGameStore((s) => s.tokens)
  const gameState = useGameStore((s) => s.gameState)
  const characters = useGameStore((s) => s.characters)
  const role = useGameStore((s) => s.role)
  const activeInitIndex = useGameStore((s) => s.activeInitIndex)
  const selectedTokenId = useGameStore((s) => s.selectedTokenId)
  const rulerPos = useGameStore((s) => s.rulerPos)

  // Init stage once
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const stage = new Konva.Stage({
      container,
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
    })

    const mapLayer = new Konva.Layer()
    const gridLayer = new Konva.Layer({ listening: false })
    const fogLayer = new Konva.Layer({ listening: false })
    const tokenLayer = new Konva.Layer()
    const rulerLayer = new Konva.Layer({ listening: false })

    stage.add(mapLayer, gridLayer, fogLayer, tokenLayer, rulerLayer)
    stageRef.current = stage
    layersRef.current = { map: mapLayer, grid: gridLayer, fog: fogLayer, tokens: tokenLayer, ruler: rulerLayer }

    stage.on('click', (e) => {
      if (e.target === stage) {
        useGameStore.getState().setSelectedToken(null)
        useGameStore.getState().setSelectedChar(null)
      }
    })

    setStageSize({ w: container.clientWidth || 800, h: container.clientHeight || 600 })

    const obs = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      if (w === 0 || h === 0) return
      stage.width(w)
      stage.height(h)
      setStageSize({ w, h })
    })
    obs.observe(container)

    return () => {
      obs.disconnect()
      stage.destroy()
      stageRef.current = null
      layersRef.current = null
    }
  }, [])

  // Map layer
  useEffect(() => {
    const layer = layersRef.current?.map
    const stage = stageRef.current
    if (!layer || !stage || stageSize.w === 0) return

    let cancelled = false
    layer.destroyChildren()

    const mapUrl = gameState?.map_image_url
    if (mapUrl) {
      Konva.Image.fromURL(mapUrl, (img) => {
        if (cancelled) return
        img.setAttrs({ width: stage.width(), height: stage.height() })
        layer.add(img)
        layer.batchDraw()
      })
    } else {
      layer.add(new Konva.Rect({ width: stage.width(), height: stage.height(), fill: '#1a1814' }))
      layer.batchDraw()
    }

    return () => { cancelled = true }
  }, [gameState?.map_image_url, stageSize])

  // Grid layer
  useEffect(() => {
    const layer = layersRef.current?.grid
    const stage = stageRef.current
    if (!layer || !stage || stageSize.w === 0) return

    layer.destroyChildren()
    const gridSize = gameState?.grid_size ?? 50
    const gridEnabled = gameState?.grid_enabled ?? true

    if (gridEnabled && gridSize > 0) {
      const w = stage.width()
      const h = stage.height()
      for (let x = 0; x <= w; x += gridSize) {
        layer.add(new Konva.Line({ points: [x, 0, x, h], stroke: 'rgba(74,67,56,0.4)', strokeWidth: 0.5 }))
      }
      for (let y = 0; y <= h; y += gridSize) {
        layer.add(new Konva.Line({ points: [0, y, w, y], stroke: 'rgba(74,67,56,0.4)', strokeWidth: 0.5 }))
      }
    }
    layer.batchDraw()
  }, [gameState?.grid_size, gameState?.grid_enabled, stageSize])

  // Fog layer
  useEffect(() => {
    const layer = layersRef.current?.fog
    if (!layer || stageSize.w === 0) return

    layer.destroyChildren()
    const fogCells = gameState?.fog_cells ?? []
    const gridSize = gameState?.grid_size ?? 50
    const fogOpacity = role === 'dm' ? 0.45 : 0.9

    for (const cell of fogCells) {
      layer.add(new Konva.Rect({
        x: (cell[0] ?? 0) * gridSize,
        y: (cell[1] ?? 0) * gridSize,
        width: gridSize,
        height: gridSize,
        fill: `rgba(0,0,0,${fogOpacity})`,
      }))
    }
    layer.batchDraw()
  }, [gameState?.fog_cells, gameState?.grid_size, role, stageSize])

  // Token layer
  useEffect(() => {
    const layer = layersRef.current?.tokens
    const stage = stageRef.current
    if (!layer || !stage || stageSize.w === 0) return

    layer.destroyChildren()
    const charMap = new Map(characters.map((c) => [c.id, c]))
    const gridSize = gameState?.grid_size ?? 50
    const tokenRadius = Math.max(14, Math.min(gridSize * 0.4, 28))
    const initiativeOrder = gameState?.initiative_order ?? []

    for (const token of tokens) {
      const char = token.character_id ? charMap.get(token.character_id) : undefined
      const x = token.rel_x * stage.width()
      const y = token.rel_y * stage.height()
      const activeEntry = initiativeOrder[activeInitIndex % Math.max(initiativeOrder.length, 1)]
      const isActive = initiativeOrder.length > 0 && activeEntry?.character_id === token.character_id
      const isSelected = token.id === selectedTokenId
      const canDrag = role === 'dm' || (token.token_type === 'pc' && char?.user_id === myUserId)
      const color = DISPOSITION_COLOR[token.disposition] ?? DISPOSITION_COLOR.neutral

      const group = new Konva.Group({ x, y, draggable: canDrag })

      if (isSelected) {
        group.add(new Konva.Circle({ radius: tokenRadius + 7, stroke: '#f4e4bc', strokeWidth: 1.5, fill: 'transparent' }))
      }
      if (isActive) {
        group.add(new Konva.Circle({ radius: tokenRadius + 4, stroke: '#d4af70', strokeWidth: 3, fill: 'transparent' }))
      }
      group.add(new Konva.Circle({ radius: tokenRadius, fill: color, stroke: '#1a1814', strokeWidth: 1.5 }))

      if (char) {
        const hpPct = Math.max(0, char.hp) / Math.max(char.max_hp, 1)
        const hpColor = hpPct > 0.5 ? '#27ae60' : hpPct > 0.25 ? '#f39c12' : '#c0392b'
        const bW = tokenRadius * 2
        group.add(new Konva.Rect({ x: -tokenRadius, y: -tokenRadius - 9, width: bW, height: 5, fill: '#1a1814', cornerRadius: 2 }))
        group.add(new Konva.Rect({ x: -tokenRadius, y: -tokenRadius - 9, width: bW * hpPct, height: 5, fill: hpColor, cornerRadius: 2 }))
      }

      group.add(new Konva.Text({
        text: token.name,
        x: -tokenRadius - 10,
        y: tokenRadius + 4,
        width: tokenRadius * 2 + 20,
        align: 'center',
        fontSize: 11,
        fill: '#f4e4bc',
        fontFamily: 'Crimson Text, serif',
        shadowColor: '#1a1814',
        shadowBlur: 4,
        shadowEnabled: true,
      }))

      group.on('click tap', () => {
        const s = useGameStore.getState()
        const next = token.id === s.selectedTokenId ? null : token.id
        s.setSelectedToken(next)
        s.setSelectedChar(next && char ? char.id : null)
      })

      group.on('dragend', (e) => {
        const sw = stage.width()
        const sh = stage.height()
        const nx = Math.max(0, Math.min(1, e.target.x() / sw))
        const ny = Math.max(0, Math.min(1, e.target.y() / sh))
        sendMessage('TOKEN_MOVE', { id: token.id, rel_x: nx, rel_y: ny })
        e.target.position({ x: nx * sw, y: ny * sh })
      })

      layer.add(group)
    }
    layer.batchDraw()
  }, [tokens, characters, gameState, activeInitIndex, selectedTokenId, role, myUserId, sendMessage, stageSize])

  // Ruler layer
  useEffect(() => {
    const layer = layersRef.current?.ruler
    const stage = stageRef.current
    if (!layer || !stage || stageSize.w === 0) return

    layer.destroyChildren()
    if (rulerPos) {
      const w = stage.width()
      const h = stage.height()
      layer.add(new Konva.Line({
        points: [rulerPos.x1 * w, rulerPos.y1 * h, rulerPos.x2 * w, rulerPos.y2 * h],
        stroke: '#d4af70',
        strokeWidth: 2,
        dash: [8, 4],
      }))
      layer.add(new Konva.Circle({
        x: rulerPos.x2 * w,
        y: rulerPos.y2 * h,
        radius: 4,
        fill: '#d4af70',
      }))
    }
    layer.batchDraw()
  }, [rulerPos, stageSize])

  return <div ref={containerRef} className="w-full h-full bg-dark cursor-crosshair" />
}
