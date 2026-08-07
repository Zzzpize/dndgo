'use client'

import { useState } from 'react'
import { NPC, MapToken, effectiveNpc } from '@/store/gameStore'
import { parseMaxHP } from '@/lib/maxhp'

function applyDelta(delta: number, currentHp: number, tempHp: number, maxHpStr: string) {
  if (delta < 0) {
    const absorbed = Math.min(-delta, tempHp)
    return { current_hp: Math.max(0, currentHp - (-delta - absorbed)), temp_hp: tempHp - absorbed }
  }
  const { numeric, isInf } = parseMaxHP(maxHpStr)
  const cap = isInf ? Infinity : numeric
  return { current_hp: Math.max(0, Math.min(cap, currentHp + delta)), temp_hp: tempHp }
}

interface Props {
  npc: NPC
  token: MapToken
  sendMessage: (type: string, payload?: unknown) => void
  role: 'dm' | 'player' | null
}

const ABILITY_LABELS = [
  { key: 'str', short: 'СИЛ' },
  { key: 'dex', short: 'ЛОВ' },
  { key: 'con', short: 'ТЕЛ' },
  { key: 'int', short: 'ИНТ' },
  { key: 'wis', short: 'МУД' },
  { key: 'cha', short: 'ХАР' },
]

const MISC_ORDER = [
  'Особенности',
  'Спасброски',
  'Навыки',
  'Иммунитет к урону',
  'Иммунитет к состоянию',
  'Сопротивление урону',
  'Уязвимость к урону',
  'Чувства',
  'Языки',
  'Опасность',
  'Бонус мастерства',
  'Местность обитания',
]

const ACTION_SECTIONS: { key: keyof NPC; label: string }[] = [
  { key: 'actions',           label: 'Действия' },
  { key: 'bonus_actions',     label: 'Бонусные действия' },
  { key: 'reactions',         label: 'Реакции' },
  { key: 'legendary_actions', label: 'Легендарные действия' },
  { key: 'mythic_actions',    label: 'Мифические действия' },
  { key: 'lair_actions',      label: 'Действия логова' },
  { key: 'regional_effects',  label: 'Региональные эффекты' },
]

function ActionBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="border-b border-dark-border last:border-b-0 pb-3 mb-3 last:pb-0 last:mb-0">
      <p className="text-parchment/50 text-xs font-fantasy mb-2">{label}</p>
      <div className="flex flex-col gap-2">
        {items.map((action, i) => (
          <p key={i} className="text-parchment/80 text-xs leading-relaxed">{action}</p>
        ))}
      </div>
    </div>
  )
}

export function NpcSheet({ npc: baseNpc, token, sendMessage, role }: Props) {
  const npc = effectiveNpc(baseNpc, token)
  const maxHp = token.max_hp ?? npc.max_hp
  const { numeric: maxHpNum, isInf: maxHpIsInf } = parseMaxHP(maxHp)
  const currentHp = token.current_hp ?? maxHpNum
  const tempHp = token.temp_hp ?? 0
  const [tab, setTab] = useState<'combat' | 'stats'>('combat')
  const [hpDelta, setHpDelta] = useState('')
  const [tempDelta, setTempDelta] = useState('')
  const [busy, setBusy] = useState(false)

  const applyHP = (delta: number) => {
    if (busy) return
    setBusy(true)
    const { current_hp, temp_hp } = applyDelta(delta, currentHp, tempHp, maxHp)
    sendMessage('TOKEN_UPDATE', { id: token.id, current_hp, temp_hp })
    setTimeout(() => setBusy(false), 300)
  }

  const applyTempHP = (val: number) => {
    if (busy) return
    setBusy(true)
    const next = Math.max(0, val)
    sendMessage('TOKEN_UPDATE', { id: token.id, current_hp: currentHp, temp_hp: next })
    setTimeout(() => setBusy(false), 300)
  }

  const handleCustomHP = () => {
    const n = parseInt(hpDelta, 10)
    if (isNaN(n) || n === 0) return
    applyHP(n)
    setHpDelta('')
  }

  const handleTempHP = () => {
    const n = parseInt(tempDelta, 10)
    if (isNaN(n)) return
    applyTempHP(n)
    setTempDelta('')
  }

  const hpPct = maxHpIsInf ? 1 : Math.max(0, currentHp) / Math.max(maxHpNum, 1)
  const hpColor = hpPct > 0.5 ? 'bg-green-600' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-ember'

  const abilities = npc.abilities ?? {}
  const misc = npc.misc ?? {}

  return (
    <div className="text-sm text-parchment">
      <div className="px-3 py-3 border-b border-dark-border">
        <p className="font-fantasy text-ember text-base leading-tight">{npc.name}</p>
        {npc.type_alignment && (
          <p className="text-parchment/50 text-xs mt-0.5">{npc.type_alignment}</p>
        )}
      </div>

      <div className="p-3 border-b border-dark-border flex flex-col gap-2">
        <p className="text-parchment/50 text-xs font-fantasy">Хиты</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-parchment leading-none">{currentHp}</span>
          <span className="text-parchment/40 text-lg leading-none mb-0.5">/ {maxHp}</span>
          {tempHp > 0 && (
            <span className="ml-1 text-sm font-bold text-sky-400 leading-none mb-0.5">+{tempHp} вр.</span>
          )}
        </div>
        <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPct * 100}%` }} />
        </div>
        {role === 'dm' && (
          <>
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
            <div className="flex gap-1 items-center">
              <span className="text-xs text-parchment/40 shrink-0">Врем. HP</span>
              <input
                type="number"
                value={tempDelta}
                onChange={(e) => setTempDelta(e.target.value)}
                placeholder={String(tempHp)}
                className="flex-1 bg-dark border border-sky-900/40 rounded px-2 py-1 text-xs text-sky-300 placeholder-parchment/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={handleTempHP}
                className="px-3 py-1 bg-sky-900/30 hover:bg-sky-900/50 border border-sky-900/40 rounded text-xs text-sky-300 transition-colors"
              >
                OK
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex border-b border-dark-border">
        {(['combat', 'stats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-fantasy transition-colors ${
              tab === t
                ? 'text-gold-light border-b-2 border-gold-light -mb-px'
                : 'text-parchment/40 hover:text-parchment/70'
            }`}
          >
            {t === 'combat' ? 'Бой' : 'Характеристики'}
          </button>
        ))}
      </div>

      {tab === 'combat' && (
        <div>
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-dark-border">
            <div className="bg-dark rounded p-2 border border-dark-border text-center">
              <p className="text-parchment/50 text-xs font-fantasy mb-1">КД</p>
              {(() => {
                const m = npc.ac.match(/^(\S+)(\s+\(.*\))?$/)
                const num = m?.[1] ?? npc.ac
                const note = m?.[2]?.trim() ?? null
                return (
                  <>
                    <p className="text-xl font-bold text-parchment">{num}</p>
                    {note && <p className="text-[10px] text-parchment/60 leading-snug mt-0.5 break-words">{note}</p>}
                  </>
                )
              })()}
            </div>
            <div className="bg-dark rounded p-2 border border-dark-border text-center">
              <p className="text-parchment/50 text-xs font-fantasy mb-1">Скорость</p>
              <p className="text-xs text-parchment leading-tight mt-1 break-words">{npc.speed || '—'}</p>
            </div>
          </div>

          <div className="p-3">
            {ACTION_SECTIONS.map(({ key, label }) => {
              const items = npc[key] as string[] | undefined
              return (
                <ActionBlock key={key} label={label} items={Array.isArray(items) ? items : []} />
              )
            })}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="p-3 flex flex-col gap-3">
          {Object.keys(abilities).length > 0 && (
            <div>
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

          {MISC_ORDER.filter((k) => misc[k]).map((key) => (
            <div key={key}>
              <p className="text-parchment/50 text-xs font-fantasy mb-1">{key}</p>
              <p className="text-parchment/80 text-xs leading-relaxed whitespace-pre-line">{misc[key]}</p>
            </div>
          ))}

          {Object.entries(misc)
            .filter(([k]) => !MISC_ORDER.includes(k))
            .map(([key, value]) => (
              <div key={key}>
                <p className="text-parchment/50 text-xs font-fantasy mb-1">{key}</p>
                <p className="text-parchment/80 text-xs leading-relaxed">{value}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
