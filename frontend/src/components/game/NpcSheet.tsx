'use client'

import { useState } from 'react'
import { NPC, MapToken } from '@/store/gameStore'

interface Props {
  npc: NPC
  token: MapToken
  sendMessage: (type: string, payload?: unknown) => void
}

const ABILITY_LABELS: { key: string; short: string }[] = [
  { key: 'str', short: 'СИЛ' },
  { key: 'dex', short: 'ЛОВ' },
  { key: 'con', short: 'ТЕЛ' },
  { key: 'int', short: 'ИНТ' },
  { key: 'wis', short: 'МУД' },
  { key: 'cha', short: 'ХАР' },
]

export function NpcSheet({ npc, token, sendMessage }: Props) {
  const currentHp = token.current_hp ?? npc.max_hp
  const maxHp = token.max_hp ?? npc.max_hp
  const [hpDelta, setHpDelta] = useState('')
  const [busy, setBusy] = useState(false)

  const applyHP = (delta: number) => {
    if (busy) return
    setBusy(true)
    const next = Math.max(0, Math.min(maxHp, currentHp + delta))
    sendMessage('TOKEN_UPDATE', { id: token.id, current_hp: next })
    setTimeout(() => setBusy(false), 300)
  }

  const handleCustomHP = () => {
    const n = parseInt(hpDelta, 10)
    if (isNaN(n) || n === 0) return
    applyHP(n)
    setHpDelta('')
  }

  const hpPct = Math.max(0, currentHp) / Math.max(maxHp, 1)
  const hpColor = hpPct > 0.5 ? 'bg-green-600' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-ember'

  const abilities = npc.abilities ?? {}
  const actions = Array.isArray(npc.actions) ? npc.actions : []

  return (
    <div className="text-sm text-parchment">
      <div className="px-3 py-3 border-b border-dark-border">
        <p className="font-fantasy text-ember text-base leading-tight">{npc.name}</p>
        {npc.type_alignment && (
          <p className="text-parchment/50 text-xs mt-0.5">{npc.type_alignment}</p>
        )}
      </div>

      {/* HP */}
      <div className="p-3 border-b border-dark-border flex flex-col gap-2">
        <p className="text-parchment/50 text-xs font-fantasy">Хиты</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-parchment leading-none">{currentHp}</span>
          <span className="text-parchment/40 text-lg leading-none mb-0.5">/ {maxHp}</span>
        </div>
        <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPct * 100}%` }} />
        </div>
        <div className="flex gap-1">
          {[-5, -1, 1, 5].map((d) => (
            <button
              key={d}
              disabled={busy}
              onClick={() => applyHP(d)}
              className={`flex-1 py-1 rounded text-xs font-bold transition-colors disabled:opacity-50 ${
                d < 0
                  ? 'bg-ember/20 text-ember hover:bg-ember/30 border border-ember/30'
                  : 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-900/40'
              }`}
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="number"
            value={hpDelta}
            onChange={(e) => setHpDelta(e.target.value)}
            placeholder="±delta"
            className="flex-1 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleCustomHP}
            className="px-3 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light transition-colors"
          >
            OK
          </button>
        </div>
      </div>

      {/* КД + Скорость */}
      <div className="grid grid-cols-2 gap-2 p-3 border-b border-dark-border">
        <div className="bg-dark rounded p-2 border border-dark-border text-center">
          <p className="text-parchment/50 text-xs font-fantasy mb-1">КД</p>
          <p className="text-xl font-bold text-parchment">{npc.ac}</p>
        </div>
        <div className="bg-dark rounded p-2 border border-dark-border text-center">
          <p className="text-parchment/50 text-xs font-fantasy mb-1">Скорость</p>
          <p className="text-xs text-parchment leading-tight mt-1">{npc.speed || '—'}</p>
        </div>
      </div>

      {/* Характеристики */}
      {Object.keys(abilities).length > 0 && (
        <div className="p-3 border-b border-dark-border">
          <p className="text-parchment/50 text-xs font-fantasy mb-2">Характеристики</p>
          <div className="grid grid-cols-6 gap-1">
            {ABILITY_LABELS.map(({ key, short }) => {
              const score = abilities[key] ?? 10
              const mod = Math.floor((score - 10) / 2)
              return (
                <div key={key} className="bg-dark rounded border border-dark-border p-1 text-center">
                  <p className="text-parchment/50 text-xs font-fantasy">{short}</p>
                  <p className="text-base font-bold text-parchment">{score}</p>
                  <p className={`text-xs ${mod >= 0 ? 'text-green-400' : 'text-ember'}`}>
                    {mod >= 0 ? `+${mod}` : mod}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Действия */}
      {actions.length > 0 && (
        <div className="p-3">
          <p className="text-parchment/50 text-xs font-fantasy mb-2">Действия</p>
          <div className="flex flex-col gap-2">
            {actions.map((action, i) => (
              <p key={i} className="text-parchment/80 text-xs leading-relaxed">
                {action}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
