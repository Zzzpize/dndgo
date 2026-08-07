'use client'

import { useRef, useEffect, useCallback } from 'react'
import Konva from 'konva'
import { useGameStore } from '@/store/gameStore'
import { useAuthStore } from '@/store/authStore'
import { hpPercent, parseMaxHP } from '@/lib/maxhp'
import api from '@/lib/api'

interface Props {
  sendMessage: (type: string, payload?: unknown) => void
  roomCode: string
}

const WORLD_W = 1000

const DISPOSITION_COLOR: Record<string, string> = {
  friendly: '#4d7a38',
  neutral: '#a08832',
  hostile: '#8c2e28',
}
const PC_COLOR = '#2a5c80'

export default function GameCanvas({ sendMessage, roomCode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const layersRef = useRef<{
    map: Konva.Layer
    grid: Konva.Layer
    fog: Konva.Layer
    tokens: Konva.Layer
    ruler: Konva.Layer
  } | null>(null)

  const activeToolRef = useRef<'pointer' | 'fog' | 'fog_hide' | 'ruler'>('pointer')
  const sendMessageRef = useRef(sendMessage)
  const isPaintingRef = useRef(false)
  const rulerStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastFogCellRef = useRef<string>('')
  const lastDragSendRef = useRef(0)
  const draggingTokenIdRef = useRef<string | null>(null)
  const worldHRef = useRef(WORLD_W)
  const tokenGroupsRef = useRef(new Map<string, Konva.Group>())
  const isPinchingRef = useRef(false)
  const lastPinchDistRef = useRef(0)

  // Fog: pending outbound batches (DM only). Flushed by an interval every ~60ms.
  const fogSendBufferRef = useRef<{ reveal: Array<{ rel_x: number; rel_y: number; radius: number; type: 'reveal' }>, hide: Array<{ rel_x: number; rel_y: number; radius: number; type: 'hide' }> }>({ reveal: [], hide: [] })
  // Fog: incremental rendering state.
  const fogGroupRef = useRef<Konva.Group | null>(null)
  const fogRenderedCountRef = useRef(0)
  const fogRenderedClearedRef = useRef(true)
  const fogCacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const myUserId = useAuthStore((s) => s.user?.id)
  const tokens = useGameStore((s) => s.tokens)
  const gameState = useGameStore((s) => s.gameState)
  const characters = useGameStore((s) => s.characters)
  const role = useGameStore((s) => s.role)
  const activeInitIndex = useGameStore((s) => s.activeInitIndex)
  const selectedTokenId = useGameStore((s) => s.selectedTokenId)
  const rulerPos = useGameStore((s) => s.rulerPos)
  const activeTool = useGameStore((s) => s.activeTool)

  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])
  useEffect(() => { worldHRef.current = WORLD_W / Math.max(gameState?.map_aspect ?? 1, 0.01) }, [gameState?.map_aspect])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      const s = useGameStore.getState()
      if (!s.selectedTokenId || s.role !== 'dm') return
      sendMessageRef.current('TOKEN_DELETE', { id: s.selectedTokenId })
      s.setSelectedToken(null)
      s.setSelectedChar(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const getWorldPos = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    const scale = stage.scaleX()
    const pos = stage.position()
    return {
      x: (pointer.x - pos.x) / scale,
      y: (pointer.y - pos.y) / scale,
    }
  }

  const flushFogBuffer = useCallback(() => {
    const buf = fogSendBufferRef.current
    if (buf.reveal.length > 0) {
      sendMessageRef.current('FOG_REVEAL', buf.reveal)
      buf.reveal = []
    }
    if (buf.hide.length > 0) {
      sendMessageRef.current('FOG_HIDE', buf.hide)
      buf.hide = []
    }
  }, [])

  const revealFogAtPointer = useCallback((stage: Konva.Stage) => {
    const wp = getWorldPos(stage)
    if (!wp) return
    const gs = useGameStore.getState().gameState
    if (gs?.fog_cleared) return
    const gridSize = gs?.grid_size ?? 50
    const rel_x = wp.x / WORLD_W
    const rel_y = wp.y / worldHRef.current
    if (rel_x < 0 || rel_y < 0 || rel_x > 1 || rel_y > 1) return
    const key = `${Math.round(wp.x / (gridSize * 0.5))},${Math.round(wp.y / (gridSize * 0.5))}`
    if (lastFogCellRef.current === key) return
    lastFogCellRef.current = key
    fogSendBufferRef.current.reveal.push({ rel_x, rel_y, radius: gridSize * 1.5, type: 'reveal' })
  }, [])

  const hideFogAtPointer = useCallback((stage: Konva.Stage) => {
    const wp = getWorldPos(stage)
    if (!wp) return
    const gs = useGameStore.getState().gameState
    if (gs?.fog_cleared) return
    const gridSize = gs?.grid_size ?? 50
    const rel_x = wp.x / WORLD_W
    const rel_y = wp.y / worldHRef.current
    if (rel_x < 0 || rel_y < 0 || rel_x > 1 || rel_y > 1) return
    const key = `${Math.round(wp.x / (gridSize * 0.5))},${Math.round(wp.y / (gridSize * 0.5))}`
    if (lastFogCellRef.current === key) return
    lastFogCellRef.current = key
    fogSendBufferRef.current.hide.push({ rel_x, rel_y, radius: gridSize * 1.5, type: 'hide' })
  }, [])

  // Periodic flush of buffered fog paint. ~60ms → ~16 packets/sec at most.
  useEffect(() => {
    const id = setInterval(flushFogBuffer, 60)
    return () => clearInterval(id)
  }, [flushFogBuffer])

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const stage = new Konva.Stage({
      container,
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
      draggable: true,
    })

    const mapLayer = new Konva.Layer()
    const gridLayer = new Konva.Layer({ listening: false })
    const fogLayer = new Konva.Layer({ listening: false })
    const tokenLayer = new Konva.Layer()
    const rulerLayer = new Konva.Layer({ listening: false })

    stage.add(mapLayer, gridLayer, fogLayer, tokenLayer, rulerLayer)
    stageRef.current = stage
    layersRef.current = { map: mapLayer, grid: gridLayer, fog: fogLayer, tokens: tokenLayer, ruler: rulerLayer }

    stage.on('wheel', (e) => {
      e.evt.preventDefault()
      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }
      const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.max(0.1, Math.min(10, oldScale * factor))
      stage.scale({ x: newScale, y: newScale })
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
    })

    stage.on('click tap', (e) => {
      if (e.target === stage) {
        useGameStore.getState().setSelectedToken(null)
        useGameStore.getState().setSelectedChar(null)
      }
    })

    stage.on('mousedown touchstart', (e) => {
      if (isPinchingRef.current) return
      const tool = activeToolRef.current
      if (tool === 'fog') {
        e.evt.preventDefault()
        isPaintingRef.current = true
        lastFogCellRef.current = ''
        revealFogAtPointer(stage)
      } else if (tool === 'fog_hide') {
        e.evt.preventDefault()
        isPaintingRef.current = true
        lastFogCellRef.current = ''
        hideFogAtPointer(stage)
      } else if (tool === 'ruler') {
        const wp = getWorldPos(stage)
        if (!wp) return
        rulerStartRef.current = wp
        sendMessageRef.current('RULER_UPDATE', {
          x1: wp.x / WORLD_W, y1: wp.y / worldHRef.current,
          x2: wp.x / WORLD_W, y2: wp.y / worldHRef.current,
        })
      }
    })

    stage.on('mousemove touchmove', (e) => {
      if (isPinchingRef.current) return
      const tool = activeToolRef.current
      if (tool === 'fog' && isPaintingRef.current) {
        e.evt.preventDefault()
        revealFogAtPointer(stage)
      } else if (tool === 'fog_hide' && isPaintingRef.current) {
        e.evt.preventDefault()
        hideFogAtPointer(stage)
      } else if (tool === 'ruler' && rulerStartRef.current) {
        const wp = getWorldPos(stage)
        if (!wp) return
        const s = rulerStartRef.current
        sendMessageRef.current('RULER_UPDATE', {
          x1: s.x / WORLD_W, y1: s.y / worldHRef.current,
          x2: wp.x / WORLD_W, y2: wp.y / worldHRef.current,
        })
      }
    })

    stage.on('mouseup touchend', () => {
      const tool = activeToolRef.current
      const wasPainting = isPaintingRef.current
      isPaintingRef.current = false
      lastFogCellRef.current = ''
      if (wasPainting && (tool === 'fog' || tool === 'fog_hide')) {
        flushFogBuffer()
      }
      if (tool === 'ruler') {
        rulerStartRef.current = null
        sendMessageRef.current('RULER_UPDATE', null)
      }
    })

    function getTouchDist(e: TouchEvent) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return
      isPinchingRef.current = true
      lastPinchDistRef.current = getTouchDist(e)
      stageRef.current?.draggable(false)
      e.preventDefault()
    }

    function onTouchMove(e: TouchEvent) {
      if (!isPinchingRef.current || e.touches.length !== 2) return
      e.preventDefault()
      const dist = getTouchDist(e)
      const factor = dist / lastPinchDistRef.current
      lastPinchDistRef.current = dist
      const s = stageRef.current
      if (!s) return
      const oldScale = s.scaleX()
      const newScale = Math.max(0.1, Math.min(10, oldScale * factor))
      const rect = container.getBoundingClientRect()
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
      const mousePointTo = {
        x: (midX - s.x()) / oldScale,
        y: (midY - s.y()) / oldScale,
      }
      s.scale({ x: newScale, y: newScale })
      s.position({
        x: midX - mousePointTo.x * newScale,
        y: midY - mousePointTo.y * newScale,
      })
      s.batchDraw()
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        isPinchingRef.current = false
        if (activeToolRef.current === 'pointer') {
          stageRef.current?.draggable(true)
        }
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)

    const obs = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      if (w > 0 && h > 0) {
        stage.width(w)
        stage.height(h)
      }
    })
    obs.observe(container)

    return () => {
      obs.disconnect()
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      stage.destroy()
      stageRef.current = null
      layersRef.current = null
      tokenGroupsRef.current.clear()
    }
  }, [revealFogAtPointer, hideFogAtPointer, flushFogBuffer])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.draggable(activeTool === 'pointer')
    if (containerRef.current) {
      containerRef.current.style.cursor =
        activeTool === 'fog' || activeTool === 'fog_hide' || activeTool === 'ruler'
          ? 'crosshair' : 'grab'
    }
  }, [activeTool])

  useEffect(() => {
    const layer = layersRef.current?.map
    if (!layer) return
    let cancelled = false
    layer.destroyChildren()
    const mapUrl = gameState?.map_image_url
    if (mapUrl) {
      Konva.Image.fromURL(mapUrl, (img) => {
        if (cancelled) return
        img.setAttrs({ width: WORLD_W, height: worldHRef.current })
        layer.add(img)
        layer.batchDraw()
      })
    } else {
      layer.add(new Konva.Rect({ width: WORLD_W, height: worldHRef.current, fill: '#1a1814' }))
      layer.batchDraw()
    }
    return () => { cancelled = true }
  }, [gameState?.map_image_url])

  useEffect(() => {
    const layer = layersRef.current?.grid
    if (!layer) return
    layer.destroyChildren()
    const gridSize = gameState?.grid_size ?? 50
    if (gameState?.grid_enabled && gridSize > 0) {
      for (let x = 0; x <= WORLD_W; x += gridSize) {
        layer.add(new Konva.Line({ points: [x, 0, x, worldHRef.current], stroke: 'rgba(74,67,56,0.4)', strokeWidth: 0.5 }))
      }
      for (let y = 0; y <= worldHRef.current; y += gridSize) {
        layer.add(new Konva.Line({ points: [0, y, WORLD_W, y], stroke: 'rgba(74,67,56,0.4)', strokeWidth: 0.5 }))
      }
    }
    layer.batchDraw()
  }, [gameState?.grid_size, gameState?.grid_enabled, gameState?.map_aspect])

  useEffect(() => {
    const layer = layersRef.current?.fog
    if (!layer) return

    const fogOpacity = role === 'dm' ? 0.45 : 1
    const worldH = worldHRef.current
    const cleared = gameState?.fog_cleared ?? true
    const paths = gameState?.fog_paths ?? []

    // Full rebuild only when the world/aspect/cleared flag flips, or when the
    // path array shrinks (undo / hard reset). Otherwise we append the tail.
    const needFullRebuild =
      cleared !== fogRenderedClearedRef.current ||
      paths.length < fogRenderedCountRef.current ||
      !fogGroupRef.current

    if (needFullRebuild) {
      layer.destroyChildren()
      fogGroupRef.current = null
      fogRenderedCountRef.current = 0
      fogRenderedClearedRef.current = cleared

      if (cleared) {
        layer.batchDraw()
        return
      }

      const g = new Konva.Group({ opacity: fogOpacity })
      g.add(new Konva.Rect({ x: 0, y: 0, width: WORLD_W, height: worldH, fill: 'black' }))
      layer.add(g)
      fogGroupRef.current = g
    }

    // Fast path: append only new circles to the existing group.
    if (!cleared && fogGroupRef.current) {
      const g = fogGroupRef.current
      g.opacity(fogOpacity)
      const start = fogRenderedCountRef.current
      if (paths.length > start) {
        // If cached, clear it before mutating children — cache is a snapshot.
        if (g.isCached()) g.clearCache()
        for (let i = start; i < paths.length; i++) {
          const p = paths[i]
          g.add(new Konva.Circle({
            x: p.rel_x * WORLD_W,
            y: p.rel_y * worldH,
            radius: p.radius,
            fill: 'black',
            globalCompositeOperation: (!p.type || p.type === 'reveal') ? 'destination-out' : 'source-over',
          }))
        }
        fogRenderedCountRef.current = paths.length
      }
    }

    layer.batchDraw()

    // Re-rasterize the group once the stream goes quiet — restores fast redraws
    // during zoom/pan without paying the cost per incoming path.
    if (fogCacheTimerRef.current) clearTimeout(fogCacheTimerRef.current)
    if (!cleared && fogGroupRef.current && worldH > 0) {
      fogCacheTimerRef.current = setTimeout(() => {
        const g = fogGroupRef.current
        if (!g) return
        g.cache({ x: 0, y: 0, width: WORLD_W, height: worldH, pixelRatio: 1 })
        layer.batchDraw()
      }, 300)
    }
  }, [gameState?.fog_paths, gameState?.fog_cleared, gameState?.map_aspect, role])

  useEffect(() => {
    const layer = layersRef.current?.tokens
    if (!layer) return

    const charMap = new Map(characters.map((c) => [c.id, c]))
    const gridSize = gameState?.grid_size ?? 50
    const initiativeOrder = gameState?.initiative_order ?? []


    const tokenIds = new Set(tokens.map((t) => t.id))
    const toRemove: string[] = []
    for (const id of tokenGroupsRef.current.keys()) {
      if (!tokenIds.has(id)) toRemove.push(id)
    }
    for (const id of toRemove) {
      tokenGroupsRef.current.get(id)?.destroy()
      tokenGroupsRef.current.delete(id)
    }

    for (const token of tokens) {
      const char = token.character_id ? charMap.get(token.character_id) : undefined
      const x = token.rel_x * WORLD_W
      const y = token.rel_y * worldHRef.current
      const activeEntry = initiativeOrder[activeInitIndex % Math.max(initiativeOrder.length, 1)]
      const isActive = initiativeOrder.length > 0 && !!activeEntry?.token_id && activeEntry.token_id === token.id
      const isSelected = token.id === selectedTokenId
      const canDrag = activeTool === 'pointer' && (role === 'dm' || (
        token.token_type === 'pc' &&
        char?.user_id === myUserId &&
        (char?.player_active ?? true) &&
        (gameState?.player_can_move_token ?? true)
      ))
      const tokenRadius = gridSize * (token.size ?? 1) * 0.45
      const color = token.token_type === 'pc' ? PC_COLOR : (DISPOSITION_COLOR[token.disposition] ?? DISPOSITION_COLOR.neutral)

      const hpPct = char
        ? hpPercent(char.hp, char.max_hp)
        : (token.current_hp !== undefined && token.max_hp != null)
          ? hpPercent(token.current_hp, token.max_hp)
          : null
      const isDead = hpPct === 0

      let group = tokenGroupsRef.current.get(token.id)
      if (!group) {
        group = new Konva.Group({ x, y })
        tokenGroupsRef.current.set(token.id, group)
        layer.add(group)
      } else if (token.id !== draggingTokenIdRef.current) {
        group.position({ x, y })
      }
      group.draggable(canDrag)

      group.destroyChildren()

      if (isSelected) {
        group.add(new Konva.Circle({ radius: tokenRadius + 7, stroke: '#f4e4bc', strokeWidth: 1.5, fill: 'transparent' }))
      }
      if (isActive) {
        group.add(new Konva.Circle({ radius: tokenRadius + 4, stroke: '#d4af70', strokeWidth: 3, fill: 'transparent' }))
      }
      group.add(new Konva.Circle({ radius: tokenRadius, fill: color, stroke: '#1a1814', strokeWidth: 1.5 }))
      if (isDead) {
        group.add(new Konva.Circle({ radius: tokenRadius, fill: 'rgba(55,55,55,0.75)', strokeWidth: 0 }))
      }

      if (hpPct !== null) {
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

      group.off('click tap dragstart dragmove dragend')

      group.on('click tap', (e) => {
        e.cancelBubble = true
        const s = useGameStore.getState()
        const next = token.id === s.selectedTokenId ? null : token.id
        s.setSelectedToken(next)
        s.setSelectedChar(next && token.character_id ? token.character_id : null)
      })

      group.on('dragstart', () => {
        stageRef.current?.draggable(false)
        lastDragSendRef.current = 0
        draggingTokenIdRef.current = token.id
      })

      group.on('dragmove', () => {
        const now = Date.now()
        if (now - lastDragSendRef.current < 50) return
        lastDragSendRef.current = now
        const nx = Math.max(0, Math.min(1, group!.x() / WORLD_W))
        const ny = Math.max(0, Math.min(1, group!.y() / worldHRef.current))
        sendMessageRef.current('TOKEN_DRAG', { id: token.id, rel_x: nx, rel_y: ny })
        if (token.token_type === 'pc') {
          const s = useGameStore.getState()
          if (!s.gameState?.fog_cleared && (s.gameState?.player_can_reveal_fog ?? true)) {
            const gs = s.gameState?.grid_size ?? 50
            sendMessageRef.current('FOG_REVEAL', [{ rel_x: nx, rel_y: ny, radius: (gs / 5) * 30 }])
          }
        }
      })

      group.on('dragend', (e) => {
        draggingTokenIdRef.current = null
        if (activeToolRef.current === 'pointer') {
          stageRef.current?.draggable(true)
        }
        const nx = Math.max(0, Math.min(1, e.target.x() / WORLD_W))
        const ny = Math.max(0, Math.min(1, e.target.y() / worldHRef.current))
        sendMessageRef.current('TOKEN_MOVE', { id: token.id, rel_x: nx, rel_y: ny })
        e.target.position({ x: nx * WORLD_W, y: ny * worldHRef.current })

        if (token.token_type === 'pc') {
          const s = useGameStore.getState()
          if (s.gameState?.fog_cleared) return
          if (!(s.gameState?.player_can_reveal_fog ?? true)) return
          const gs = s.gameState?.grid_size ?? 50
          sendMessageRef.current('FOG_REVEAL', [{ rel_x: nx, rel_y: ny, radius: (gs / 5) * 30 }])
        }
      })
    }
    layer.batchDraw()
  }, [tokens, characters, gameState?.grid_size, gameState?.initiative_order, gameState?.map_aspect, gameState?.player_can_move_token, activeInitIndex, selectedTokenId, role, myUserId, activeTool])

  useEffect(() => {
    const layer = layersRef.current?.ruler
    if (!layer) return
    layer.destroyChildren()
    if (rulerPos) {
      const x1 = rulerPos.x1 * WORLD_W
      const y1 = rulerPos.y1 * worldHRef.current
      const x2 = rulerPos.x2 * WORLD_W
      const y2 = rulerPos.y2 * worldHRef.current
      const dx = x2 - x1
      const dy = y2 - y1
      const gridSize = useGameStore.getState().gameState?.grid_size ?? 50
      const distFt = Math.round((Math.sqrt(dx * dx + dy * dy) / gridSize) * 5)

      layer.add(new Konva.Line({
        points: [x1, y1, x2, y2],
        stroke: '#d4af70',
        strokeWidth: 2,
        dash: [8, 4],
      }))
      layer.add(new Konva.Circle({ x: x2, y: y2, radius: 4, fill: '#d4af70' }))

      const label = new Konva.Label({ x: x2 + 8, y: y2 - 20 })
      label.add(new Konva.Tag({ fill: 'rgba(0,0,0,0.75)', cornerRadius: 3 }))
      label.add(new Konva.Text({
        text: `${distFt} ft`,
        padding: 4,
        fill: '#d4af70',
        fontSize: 12,
        fontFamily: 'Crimson Text, serif',
      }))
      layer.add(label)
    }
    layer.batchDraw()
  }, [rulerPos])

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    const container = containerRef.current
    if (!stage || !container) return
    const rect = container.getBoundingClientRect()
    const scale = stage.scaleX()
    const pos = stage.position()
    const worldX = (e.clientX - rect.left - pos.x) / scale
    const worldY = (e.clientY - rect.top - pos.y) / scale
    const s = useGameStore.getState()
    const gridSize = s.gameState?.grid_size ?? 50
    for (const token of s.tokens) {
      const tokenRadius = gridSize * (token.size ?? 1) * 0.45
      const tx = token.rel_x * WORLD_W
      const ty = token.rel_y * worldHRef.current
      const dist = Math.sqrt((worldX - tx) ** 2 + (worldY - ty) ** 2)
      if (dist <= tokenRadius + 4) {
        const char = s.characters.find((c) => c.id === token.character_id)
        const uid = useAuthStore.getState().user?.id
        const canEdit = s.role === 'dm' || (
          token.token_type === 'pc' &&
          char?.user_id === uid &&
          (char?.player_active ?? true) &&
          (s.gameState?.player_can_edit_token ?? true)
        )
        if (canEdit) s.setEditingTokenId(token.id)
        return
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const addNpc = useGameStore((s) => s.addNpc)

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const stage = stageRef.current
    const container = containerRef.current
    if (!stage || !container) return
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    let data: Record<string, unknown>
    try { data = JSON.parse(raw) } catch { return }

    const rect = container.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const scale = stage.scaleX()
    const pos = stage.position()
    const worldX = (px - pos.x) / scale
    const worldY = (py - pos.y) / scale
    const relX = Math.max(0, Math.min(1, worldX / WORLD_W))
    const relY = Math.max(0, Math.min(1, worldY / worldHRef.current))

    let npcId: string | undefined = data.npc_id as string | undefined
    let maxHp: string | undefined = data.max_hp as string | undefined
    let currentHp: number | undefined = data.current_hp as number | undefined

    if (data.bestiary_id) {
      try {
        const { data: npc } = await api.post(`/api/v1/rooms/${roomCode}/npcs/from-bestiary`, {
          monster_id: data.bestiary_id,
        })
        addNpc(npc)
        npcId = npc.id
        maxHp = npc.max_hp
        currentHp = parseMaxHP(npc.max_hp).numeric
        data = { ...data, size: npc.size ?? 1 }
      } catch { }
    }

    sendMessageRef.current('TOKEN_CREATE', {
      token_type: data.token_type,
      character_id: data.character_id ?? undefined,
      npc_id: npcId,
      name: data.name,
      rel_x: relX,
      rel_y: relY,
      disposition: data.disposition ?? 'neutral',
      max_hp: maxHp,
      current_hp: currentHp,
      size: (data.size as number | undefined) ?? 1,
    })
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
    />
  )
}
