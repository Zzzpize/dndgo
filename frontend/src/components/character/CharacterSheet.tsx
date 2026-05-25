'use client'

import { useState, useEffect } from 'react'
import { Character, useGameStore } from '@/store/gameStore'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

interface Props {
  character: Character
  sendMessage?: (type: string, payload?: unknown) => void
}

type Tab = 'combat' | 'stats' | 'spells' | 'inventory'

const STAT_LABELS: Array<[keyof NonNullable<Character['stats']>, string, keyof NonNullable<Character['stats']>]> = [
  ['strength', 'СИЛ', 'str_mod'],
  ['dexterity', 'ЛОВ', 'dex_mod'],
  ['constitution', 'ТЕЛ', 'con_mod'],
  ['intelligence', 'ИНТ', 'int_mod'],
  ['wisdom', 'МУД', 'wis_mod'],
  ['charisma', 'ХАР', 'cha_mod'],
]

export function CharacterSheet({ character, sendMessage }: Props) {
  const [tab, setTab] = useState<Tab>('combat')
  const [hpDelta, setHpDelta] = useState('')
  const [tempInput, setTempInput] = useState('')
  const [saving, setSaving] = useState(false)
  const updateCharacter = useGameStore((s) => s.updateCharacter)
  const role = useGameStore((s) => s.role)
  const myUserId = useAuthStore((s) => s.user?.id)
  const gameState = useGameStore((s) => s.gameState)
  const isOwner = character.user_id === myUserId
  const canEditHP = role === 'dm' || (
    isOwner &&
    (character.player_active ?? true) &&
    (gameState?.player_can_edit_token ?? true) &&
    (gameState?.player_can_edit_hp ?? true)
  )
  useEffect(() => { setTab('combat') }, [character.id])

  const applyHP = async (delta: number) => {
    if (saving) return
    setSaving(true)
    try {
      const { data } = await api.patch(`/api/v1/characters/${character.id}/hp`, { delta })
      updateCharacter(data)
      sendMessage?.('CHARACTER_UPDATE', data)
    } finally {
      setSaving(false)
    }
  }

  const handleCustomHP = async () => {
    const n = parseInt(hpDelta, 10)
    if (isNaN(n) || n === 0) return
    await applyHP(n)
    setHpDelta('')
  }

  const applyTempHP = async () => {
    const n = parseInt(tempInput, 10)
    if (isNaN(n) || n < 0 || saving) return
    setSaving(true)
    try {
      const { data } = await api.patch(`/api/v1/characters/${character.id}/hp`, { delta: 0, temp_hp: n })
      updateCharacter(data)
      sendMessage?.('CHARACTER_UPDATE', data)
      setTempInput('')
    } finally {
      setSaving(false)
    }
  }

  const hpPct = Math.max(0, character.hp) / Math.max(character.max_hp, 1)
  const hpColor = hpPct > 0.5 ? 'bg-green-600' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-ember'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'combat', label: 'Бой' },
    { key: 'stats', label: 'Характеристики' },
    { key: 'spells', label: 'Заклинания' },
    { key: 'inventory', label: 'Инвентарь' },
  ]

  return (
    <div className="text-sm text-parchment">
      <div className="px-3 py-3 border-b border-dark-border">
        <p className="font-fantasy text-gold-light text-base leading-tight">{character.name}</p>
        <p className="text-parchment/50 text-xs mt-0.5">
          {[character.race, character.subrace, character.class, character.subclass, `${character.level} ур.`]
            .filter(Boolean).join(' • ')}
        </p>
      </div>

      <div className="p-3 border-b border-dark-border flex flex-col gap-2">
        <p className="text-parchment/50 text-xs font-fantasy">Хиты</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-parchment leading-none">{character.hp}</span>
          <span className="text-parchment/40 text-lg leading-none mb-0.5">/ {character.max_hp}</span>
          {character.temp_hp > 0 && (
            <span className="ml-1 text-sm font-bold text-sky-400 leading-none mb-0.5">+{character.temp_hp} вр.</span>
          )}
        </div>
        <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPct * 100}%` }} />
        </div>
        {canEditHP && (
          <>
            <div className="flex gap-1">
              {[-5, -1, 1, 5].map((d) => (
                <button
                  key={d}
                  disabled={saving}
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomHP() }}
                placeholder="±delta"
                className="flex-1 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                disabled={saving}
                onClick={handleCustomHP}
                className="px-3 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light transition-colors disabled:opacity-50"
              >
                OK
              </button>
            </div>
            <div className="flex gap-1 items-center">
              <span className="text-xs text-parchment/40 shrink-0">Врем. HP</span>
              <input
                type="number"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyTempHP() }}
                placeholder={String(character.temp_hp)}
                className="flex-1 bg-dark border border-sky-900/40 rounded px-2 py-1 text-xs text-sky-300 placeholder-parchment/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                disabled={saving}
                onClick={applyTempHP}
                className="px-3 py-1 bg-sky-900/30 hover:bg-sky-900/50 border border-sky-900/40 rounded text-xs text-sky-300 transition-colors disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </>
        )}
      </div>

<div className="flex border-b border-dark-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-fantasy transition-colors ${
              tab === key
                ? 'text-gold-light border-b-2 border-gold-light -mb-px'
                : 'text-parchment/40 hover:text-parchment/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'combat' && <CombatTab character={character} />}
        {tab === 'stats' && <StatsTab character={character} />}
        {tab === 'spells' && <SpellsTab character={character} />}
        {tab === 'inventory' && <InventoryTab character={character} />}
      </div>
    </div>
  )
}

function CombatTab({ character }: { character: Character }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-dark rounded p-2 border border-dark-border text-center">
        <p className="text-parchment/50 text-xs font-fantasy mb-1">КД</p>
        <p className="text-xl font-bold text-parchment">{character.effective_ac}</p>
        {(character.stats?.shield_bonus ?? 0) > 0 && (
          <p className="text-[10px] text-parchment/60 mt-0.5">(щит: +{character.stats!.shield_bonus})</p>
        )}
      </div>
      <div className="bg-dark rounded p-2 border border-dark-border text-center">
        <p className="text-parchment/50 text-xs font-fantasy mb-1">Скорость</p>
        <p className="text-xs text-parchment leading-tight mt-1 break-words">
          {character.stats?.speed || '—'}
        </p>
      </div>
    </div>
  )
}

function StatsTab({ character }: { character: Character }) {
  const stats = character.stats
  if (!stats) {
    return <p className="text-parchment/40 text-xs">Характеристики не заданы</p>
  }

  return (
    <div className="grid grid-cols-6 gap-1">
      {STAT_LABELS.map(([key, label, modKey]) => {
        const score = stats[key] as number
        const mod = stats[modKey] as number
        return (
          <div key={key} className="bg-dark rounded border border-dark-border p-1 text-center">
            <p className="text-parchment/50 text-xs font-fantasy">{label}</p>
            <p className="text-base font-bold text-parchment">{score}</p>
            <p className={`text-xs ${mod >= 0 ? 'text-green-400' : 'text-ember'}`}>
              {mod >= 0 ? `+${mod}` : mod}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function SpellsTab({ character }: { character: Character }) {
  const slots = character.spell_slots

  if (!slots || (typeof slots === 'object' && Object.keys(slots as object).length === 0)) {
    return <p className="text-parchment/40 text-xs">Ячеек заклинаний нет</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-parchment/50 text-xs font-fantasy">Ячейки заклинаний</p>
      <pre className="text-parchment/70 text-xs bg-dark p-2 rounded border border-dark-border overflow-auto max-h-48">
        {JSON.stringify(slots, null, 2)}
      </pre>
    </div>
  )
}

interface WeaponEntry { name?: string; attack_bonus?: string; damage?: string }

function InventoryTab({ character }: { character: Character }) {
  const weapons = Array.isArray(character.weapons) ? (character.weapons as WeaponEntry[]) : []

  return (
    <div className="flex flex-col gap-3">
      {weapons.length > 0 && (
        <div>
          <p className="text-parchment/50 text-xs font-fantasy mb-1">Оружие</p>
          <div className="flex flex-col gap-1">
            {weapons.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 bg-dark rounded border border-dark-border/50">
                <span className="flex-1 text-parchment">{w.name || '—'}</span>
                {w.attack_bonus && <span className="text-gold-light font-mono">{w.attack_bonus}</span>}
                {w.damage && <span className="text-parchment/50">{w.damage}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {character.inventory && (
        <div>
          <p className="text-parchment/50 text-xs font-fantasy mb-1">Инвентарь</p>
          <p className="text-parchment/70 text-xs bg-dark p-2 rounded border border-dark-border whitespace-pre-wrap">
            {character.inventory}
          </p>
        </div>
      )}
      <div>
        <p className="text-parchment/50 text-xs font-fantasy mb-1">Заметки</p>
        <p className="text-parchment/70 text-xs bg-dark p-2 rounded border border-dark-border min-h-[4rem] whitespace-pre-wrap">
          {character.notes || <span className="text-parchment/30 italic">Пусто</span>}
        </p>
      </div>
    </div>
  )
}
