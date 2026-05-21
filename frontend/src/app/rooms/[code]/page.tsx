'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@/store/authStore'
import { useGameStore } from '@/store/gameStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/Button'
import { CharacterSheet } from '@/components/character/CharacterSheet'
import { CharacterModal } from '@/components/character/CharacterModal'
import { NpcSheet } from '@/components/game/NpcSheet'
import { DMPanel } from '@/components/game/DMPanel'
import { DiceRoller } from '@/components/dice/DiceRoller'
import api from '@/lib/api'

type Tool = 'pointer' | 'fog' | 'ruler'
const TOOLS: { key: Tool; icon: string; title: string }[] = [
  { key: 'pointer', icon: '✥', title: 'Указатель' },
  { key: 'ruler',  icon: '📏', title: 'Линейка' },
  { key: 'fog',    icon: '☁',  title: 'Туман войны' },
]

function ToolBar() {
  const activeTool = useGameStore((s) => s.activeTool)
  const setActiveTool = useGameStore((s) => s.setActiveTool)
  return (
    <div className="absolute top-3 left-3 flex flex-col gap-1 z-20">
      {TOOLS.map(({ key, icon, title }) => (
        <button
          key={key}
          title={title}
          onClick={() => setActiveTool(key)}
          className={`w-9 h-9 flex items-center justify-center rounded border text-base transition-colors ${
            activeTool === key
              ? 'bg-gold/30 border-gold text-gold-light'
              : 'bg-dark-card/80 border-dark-border text-parchment/50 hover:text-parchment/80 hover:border-dark-border/80'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-dark">
      <p className="text-parchment/20 animate-pulse font-fantasy tracking-widest">Загрузка карты...</p>
    </div>
  ),
})

interface RoomInfo {
  id: string
  code: string
  name: string
  dm_user_id: string
  role: string
}

export default function RoomPage() {
  const params = useParams()
  const code = params.code as string
  const router = useRouter()

  const { user, hydrated, hydrate } = useAuthStore()
  const role = useGameStore((s) => s.role)
  const isConnected = useGameStore((s) => s.isConnected)
  const selectedCharId = useGameStore((s) => s.selectedCharId)
  const setRole = useGameStore((s) => s.setRole)
  const setCharacters = useGameStore((s) => s.setCharacters)
  const setNpcs = useGameStore((s) => s.setNpcs)
  const setSelectedChar = useGameStore((s) => s.setSelectedChar)
  const setSelectedToken = useGameStore((s) => s.setSelectedToken)
  const reset = useGameStore((s) => s.reset)
  const selectedTokenId = useGameStore((s) => s.selectedTokenId)
  const selectedChar = useGameStore((s) =>
    s.characters.find((c) => c.id === s.selectedCharId) ?? null
  )
  const selectedToken = useGameStore((s) =>
    s.tokens.find((t) => t.id === s.selectedTokenId) ?? null
  )
  const selectedNpc = useGameStore((s) => {
    const token = s.tokens.find((t) => t.id === s.selectedTokenId)
    if (!token?.npc_id) return null
    return s.npcs.find((n) => n.id === token.npc_id) ?? null
  })

  const myChar = useGameStore((s) => s.characters.find((c) => c.user_id === user?.id) ?? null)

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDMPanel, setShowDMPanel] = useState(true)
  const [charModalOpen, setCharModalOpen] = useState(false)

  const { sendMessage } = useWebSocket(code)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!hydrated) return
    if (!user) {
      router.replace('/login')
      return
    }

    Promise.all([
      api.get<RoomInfo>(`/api/v1/rooms/${code}`),
      api.get(`/api/v1/rooms/${code}/characters`),
      api.get(`/api/v1/rooms/${code}/npcs`),
    ])
      .then(([roomRes, charsRes, npcsRes]) => {
        setRoom(roomRes.data)
        setRole(roomRes.data.role as 'dm' | 'player')
        setCharacters(charsRes.data)
        setNpcs(npcsRes.data)
      })
      .catch(() => {
        router.replace('/rooms')
      })
      .finally(() => setLoading(false))
  }, [hydrated, user, code, router, setRole, setCharacters, setNpcs])

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark">
        <p className="text-parchment/40 font-fantasy tracking-widest animate-pulse">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-dark overflow-hidden">
      <header className="border-b border-dark-border bg-dark-card px-4 py-2 flex items-center justify-between shrink-0 h-12">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/rooms')}
            className="text-parchment/40 hover:text-parchment/70 text-sm transition-colors"
          >
            ← Назад
          </button>
          <span className="text-dark-border">|</span>
          <h1 className="heading-fantasy text-base">{room?.name ?? code}</h1>
          {role && (
            <span
              className={`text-xs px-2 py-0.5 rounded font-fantasy ${
                role === 'dm'
                  ? 'bg-gold/20 text-gold-light border border-gold/30'
                  : 'bg-steel/20 text-steel-light border border-steel/30'
              }`}
            >
              {role === 'dm' ? 'Мастер' : 'Игрок'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs flex items-center gap-1.5 ${
              isConnected ? 'text-green-400' : 'text-ember'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-ember animate-pulse'}`}
            />
            {isConnected ? 'Подключено' : 'Переподключение...'}
          </span>
          <span className="text-sm text-parchment/50">{user?.username}</span>
          {role === 'dm' && (
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setShowDMPanel((v) => !v)}
            >
              {showDMPanel ? 'Скрыть панель' : 'Панель ДМ'}
            </Button>
          )}
          {role === 'player' && (
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setCharModalOpen(true)}
            >
              {myChar ? 'Персонаж' : '+ Персонаж'}
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 relative overflow-hidden">
            <GameCanvas sendMessage={sendMessage} />
            <DiceLogOverlay />
            {role === 'dm' && <ToolBar />}
          </div>
          <DiceRoller sendMessage={sendMessage} />
        </div>

        {role === 'dm' && showDMPanel && (
          <DMPanel sendMessage={sendMessage} roomCode={code} />
        )}

        {selectedCharId && selectedChar && (
          <div className="w-80 border-l border-dark-border bg-dark-card flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-dark-border shrink-0">
              <span className="text-xs font-fantasy text-gold-light">Лист персонажа</span>
              <button
                onClick={() => { setSelectedChar(null); setSelectedToken(null) }}
                className="text-parchment/40 hover:text-parchment/70 text-sm w-6 h-6 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <CharacterSheet character={selectedChar} sendMessage={sendMessage} />
            </div>
          </div>
        )}

        {selectedTokenId && selectedNpc && selectedToken && !selectedCharId && (
          <div className="w-80 border-l border-dark-border bg-dark-card flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-dark-border shrink-0">
              <span className="text-xs font-fantasy text-ember">НПС</span>
              <button
                onClick={() => { setSelectedChar(null); setSelectedToken(null) }}
                className="text-parchment/40 hover:text-parchment/70 text-sm w-6 h-6 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <NpcSheet npc={selectedNpc} token={selectedToken} sendMessage={sendMessage} />
            </div>
          </div>
        )}
      </div>

      {charModalOpen && (
        <CharacterModal
          roomCode={code}
          character={myChar ?? undefined}
          onClose={() => setCharModalOpen(false)}
          onSaved={() => setCharModalOpen(false)}
        />
      )}
    </div>
  )
}

function DiceLogOverlay() {
  const diceLogs = useGameStore((s) => s.diceLogs)
  const characters = useGameStore((s) => s.characters)
  const visible = diceLogs.slice(0, 5)

  if (diceLogs.length === 0) return null

  return (
    <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 pointer-events-none max-w-xs">
      {diceLogs.map((log) => {
        const char = characters.find((c) => c.user_id === log.user_id)
        const name = char?.name ?? 'Игрок'
        return (
          <div
            key={log.id}
            className="bg-dark-card/90 border border-dark-border px-3 py-2 rounded animate-fade-in backdrop-blur-sm"
          >
            <span className="text-gold-light font-fantasy text-xs">{name}</span>
            <span className="text-parchment/50 mx-1 text-xs">→</span>
            <span className="text-parchment text-sm font-semibold">{log.notation}</span>
            <span className="text-parchment/50 mx-1 text-xs">=</span>
            <span className="text-gold-light font-bold">{log.total}</span>
            {log.rolls.length > 1 && (
              <span className="text-parchment/30 text-xs ml-1">
                [{log.rolls.join(', ')}]
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
