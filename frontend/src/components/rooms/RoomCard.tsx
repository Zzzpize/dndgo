'use client'

import { useState } from 'react'

export interface Room {
  id: string
  code: string
  name: string
  dm_user_id: string
  role: string
  created_at: string
}

interface RoomCardProps {
  room: Room
  onEnter: (room: Room) => void
}

export function RoomCard({ room, onEnter }: RoomCardProps) {
  const [showCode, setShowCode] = useState(false)

  return (
    <div className="bg-dark-card border border-dark-border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="heading-fantasy text-lg">{room.name}</h3>
          <span className={`text-xs uppercase tracking-widest font-fantasy ${room.role === 'dm' ? 'text-gold' : 'text-steel-light'}`}>
            {room.role === 'dm' ? '⚔ Мастер' : '⚉ Игрок'}
          </span>
        </div>
        <button
          onClick={() => onEnter(room)}
          className="px-3 py-1 border border-gold text-gold hover:bg-dark-hover font-fantasy text-xs tracking-wider uppercase transition-colors"
        >
          Войти
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-parchment/50 text-xs font-fantasy uppercase tracking-wide">Код:</span>
        {showCode ? (
          <span className="font-mono text-gold-light tracking-[0.2em]">{room.code}</span>
        ) : (
          <span className="text-parchment/30 tracking-[0.2em] font-mono">••••••</span>
        )}
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-xs text-parchment/40 hover:text-parchment/70 transition-colors underline"
        >
          {showCode ? 'Скрыть' : 'Показать'}
        </button>
      </div>

      <p className="text-xs text-parchment/30">
        {new Date(room.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
