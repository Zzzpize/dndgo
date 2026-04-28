'use client'

import { useState } from 'react'
import { Character, useGameStore } from '@/store/gameStore'
import api from '@/lib/api'

interface Props {
  character: Character
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

export function CharacterSheet({ character }: Props) {
  const [tab, setTab] = useState<Tab>('combat')
  const [hpDelta, setHpDelta] = useState('')
  const [saving, setSaving] = useState(false)
  const updateCharacter = useGameStore((s) => s.updateCharacter)

  const applyHP = async (delta: number) => {
    if (saving) return
    setSaving(true)
    try {
      const { data } = await api.patch(`/api/v1/characters/${character.id}/hp`, { delta })
      updateCharacter(data)
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'combat', label: 'Бой' },
    { key: 'stats', label: 'Стат' },
    { key: 'spells', label: 'Заклинания' },
    { key: 'inventory', label: 'Инвентарь' },
  ]

  return (
    <div className="text-sm text-parchment">
      <div className="px-3 py-3 border-b border-dark-border">
        <p className="font-fantasy text-gold-light text-base leading-tight">{character.name}</p>
        <p className="text-parchment/50 text-xs mt-0.5">
          {[character.race, character.class, `${character.level} ур.`].filter(Boolean).join(' • ')}
        </p>
      </div>

      <div className="flex border-b border-dark-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 text-xs font-fantasy transition-colors ${
              tab === key
                ? 'text-gold-light border-b-2 border-gold'
                : 'text-parchment/40 hover:text-parchment/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'combat' && (
          <CombatTab character={character} hpDelta={hpDelta} setHpDelta={setHpDelta} saving={saving} applyHP={applyHP} handleCustomHP={handleCustomHP} />
        )}
        {tab === 'stats' && <StatsTab character={character} />}
        {tab === 'spells' && <SpellsTab character={character} />}
        {tab === 'inventory' && <InventoryTab character={character} />}
      </div>
    </div>
  )
}

function CombatTab({ character, hpDelta, setHpDelta, saving, applyHP, handleCustomHP }: {
  character: Character
  hpDelta: string
  setHpDelta: (v: string) => void
  saving: boolean
  applyHP: (d: number) => Promise<void>
  handleCustomHP: () => Promise<void>
}) {
  const hpPct = Math.max(0, character.hp) / Math.max(character.max_hp, 1)
  const hpColor = hpPct > 0.5 ? 'bg-green-600' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-ember'

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-dark rounded p-3 border border-dark-border">
        <p className="text-parchment/50 text-xs mb-1 font-fantasy">Хиты</p>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold text-parchment leading-none">{character.hp}</span>
          <span className="text-parchment/40 text-lg leading-none mb-0.5">/ {character.max_hp}</span>
        </div>
        <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden mb-3">
          <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPct * 100}%` }} />
        </div>
        <div className="flex gap-1 mb-2">
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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-dark rounded p-3 border border-dark-border text-center">
          <p className="text-parchment/50 text-xs font-fantasy mb-1">КД</p>
          <p className="text-2xl font-bold text-parchment">{character.ac}</p>
        </div>
        <div className="bg-dark rounded p-3 border border-dark-border text-center">
          <p className="text-parchment/50 text-xs font-fantasy mb-1">КД (щит)</p>
          <p className="text-2xl font-bold text-parchment">{character.effective_ac}</p>
        </div>
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
    <div className="grid grid-cols-3 gap-2">
      {STAT_LABELS.map(([key, label, modKey]) => {
        const score = stats[key] as number
        const mod = stats[modKey] as number
        return (
          <div key={key} className="bg-dark rounded border border-dark-border p-2 text-center">
            <p className="text-parchment/50 text-xs font-fantasy mb-1">{label}</p>
            <p className="text-xl font-bold text-parchment leading-none">{score}</p>
            <p className={`text-xs mt-0.5 ${mod >= 0 ? 'text-green-400' : 'text-ember'}`}>
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

function InventoryTab({ character }: { character: Character }) {
  return (
    <div className="flex flex-col gap-3">
      {character.weapons != null && (
        <div>
          <p className="text-parchment/50 text-xs font-fantasy mb-1">Оружие</p>
          <pre className="text-parchment/70 text-xs bg-dark p-2 rounded border border-dark-border overflow-auto max-h-32">
            {JSON.stringify(character.weapons as object, null, 2)}
          </pre>
        </div>
      )}
      <div>
        <p className="text-parchment/50 text-xs font-fantasy mb-1">Заметки</p>
        <p className="text-parchment/70 text-xs bg-dark p-2 rounded border border-dark-border min-h-16 whitespace-pre-wrap">
          {character.notes || <span className="text-parchment/30 italic">Пусто</span>}
        </p>
      </div>
    </div>
  )
}
