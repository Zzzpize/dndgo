'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { RoomCard, Room } from '@/components/rooms/RoomCard'
import { CreateRoomModal } from '@/components/rooms/CreateRoomModal'
import { JoinRoomModal } from '@/components/rooms/JoinRoomModal'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'

export default function RoomsPage() {
  const router = useRouter()
  const { user, hydrated, hydrate, logout } = useAuthStore()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!hydrated) return
    if (!user) { router.replace('/login'); return }
    api.get('/api/v1/rooms').then(({ data }) => setRooms(data)).finally(() => setLoading(false))
  }, [hydrated, user, router])

  const handleCreated = (room: Room) => setRooms((prev) => [room, ...prev])
  const handleJoined = (room: Room) => {
    setRooms((prev) => prev.some((r) => r.id === room.id) ? prev : [room, ...prev])
  }
  const handleEnter = (room: Room) => router.push(`/rooms/${room.code}`)

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-parchment/40 font-fantasy tracking-widest animate-pulse">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-dark-border bg-dark-card px-6 py-3 flex items-center justify-between">
        <h1 className="heading-fantasy text-xl">D&D VTT</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-parchment/60">{user?.username}</span>
          <Button variant="ghost" onClick={logout} className="text-xs">Выйти</Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="heading-fantasy text-2xl">Мои комнаты</h2>
            <p className="text-parchment/50 text-sm mt-1">Ваши игровые сессии</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowJoin(true)}>Войти по коду</Button>
            <Button onClick={() => setShowCreate(true)}>Создать комнату</Button>
          </div>
        </div>

        <hr className="divider-gold mb-6" />

        {rooms.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🎲</p>
            <p className="heading-fantasy text-xl text-parchment/40 mb-2">Нет комнат</p>
            <p className="text-parchment/30 text-sm">Создайте комнату или войдите по коду</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onEnter={handleEnter} />
            ))}
          </div>
        )}
      </main>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      <JoinRoomModal open={showJoin} onClose={() => setShowJoin(false)} onJoined={handleJoined} />
    </div>
  )
}
