import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getStoredToken } from '@/lib/api'

const WS_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8080`)
    : 'ws://localhost:8080'

export function useWebSocket(roomCode: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(1000)
  const mounted = useRef(true)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const sendMessage = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    reconnectDelay.current = 1000

    const connect = () => {
      if (!mounted.current) return
      const token = getStoredToken()
      if (!token) return

      const ws = new WebSocket(`${WS_BASE}/api/v1/ws/${roomCode}?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectDelay.current = 1000
        useGameStore.getState().setConnected(true)
      }

      ws.onclose = () => {
        useGameStore.getState().setConnected(false)
        if (mounted.current) {
          reconnectTimer.current = setTimeout(connect, reconnectDelay.current)
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
        }
      }

      ws.onerror = () => ws.close()

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as WsMsg
          dispatch(msg)
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    return () => {
      mounted.current = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      useGameStore.getState().setConnected(false)
    }
  }, [roomCode])

  return { sendMessage }
}

type WsMsg = { type: string; payload: unknown }

function dispatch(msg: WsMsg) {
  const s = useGameStore.getState()
  switch (msg.type) {
    case 'FULL_STATE_UPDATE': {
      const { game_state, tokens } = msg.payload as { game_state: Parameters<typeof s.applyFullState>[0]; tokens: Parameters<typeof s.applyFullState>[1] }
      s.applyFullState(game_state, tokens ?? [])
      break
    }
    case 'TOKEN_CREATE':
      s.addToken(msg.payload as Parameters<typeof s.addToken>[0])
      break
    case 'TOKEN_MOVE':
      s.updateToken(msg.payload as Parameters<typeof s.updateToken>[0])
      break
    case 'TOKEN_DELETE':
      s.removeToken((msg.payload as { id: string }).id)
      break
    case 'DICE_ROLL_RESULT':
      s.addDiceLog(msg.payload as Parameters<typeof s.addDiceLog>[0])
      break
    case 'GRID_UPDATE': {
      const p = msg.payload as { grid_enabled: boolean; grid_size: number }
      s.setGrid(p.grid_enabled, p.grid_size)
      break
    }
    case 'FOG_REVEAL':
    case 'FOG_CLEAR':
      s.setFogCells(msg.payload as number[][])
      break
    case 'INIT_UPDATE':
      s.setInitiativeOrder(msg.payload as Parameters<typeof s.setInitiativeOrder>[0])
      break
    case 'INIT_NEXT':
      s.nextInitiative()
      break
    case 'INIT_END':
      s.endInitiative()
      break
    case 'RULER_UPDATE':
      s.setRulerPos(msg.payload as Parameters<typeof s.setRulerPos>[0])
      break
    case 'MAP_UPDATE':
      s.setMapImage((msg.payload as { map_image_url: string }).map_image_url)
      break
  }
}
