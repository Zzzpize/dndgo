'use client'

import { useState } from 'react'
import api from '@/lib/api'
import { NPC, useGameStore } from '@/store/gameStore'

interface AbilityScores { str: string; dex: string; con: string; int: string; wis: string; cha: string }

const defaultAbilities = (): AbilityScores => ({ str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10' })

interface NpcForm {
  name: string
  disposition: 'hostile' | 'neutral' | 'friendly'
  ac: string
  max_hp: string
  speed: string
  type_alignment: string
  abilities: AbilityScores

  features: string
  saving_throws: string
  skills: string
  damage_immunities: string
  condition_immunities: string
  damage_resistances: string
  damage_vulnerabilities: string
  senses: string
  languages: string
  challenge: string

  actionsText: string
  bonusActionsText: string
  reactionsText: string
  legendaryActionsText: string
  lairActionsText: string
  regionalEffectsText: string
  mythicActionsText: string
}

const defaultForm = (): NpcForm => ({
  name: '',
  disposition: 'hostile',
  ac: '10',
  max_hp: '10',
  speed: '30 фт.',
  type_alignment: '',
  abilities: defaultAbilities(),
  features: '',
  saving_throws: '',
  skills: '',
  damage_immunities: '',
  condition_immunities: '',
  damage_resistances: '',
  damage_vulnerabilities: '',
  senses: '',
  languages: '',
  challenge: '',
  actionsText: '',
  bonusActionsText: '',
  reactionsText: '',
  legendaryActionsText: '',
  lairActionsText: '',
  regionalEffectsText: '',
  mythicActionsText: '',
})

const fromNPC = (n: NPC): NpcForm => {
  const misc = n.misc ?? {}
  return {
    name: n.name,
    disposition: n.disposition,
    ac: n.ac,
    max_hp: String(n.max_hp),
    speed: n.speed,
    type_alignment: n.type_alignment,
    abilities: {
      str: String(n.abilities?.str ?? 10),
      dex: String(n.abilities?.dex ?? 10),
      con: String(n.abilities?.con ?? 10),
      int: String(n.abilities?.int ?? 10),
      wis: String(n.abilities?.wis ?? 10),
      cha: String(n.abilities?.cha ?? 10),
    },
    features:               misc['Особенности'] ?? '',
    saving_throws:          misc['Спасброски'] ?? '',
    skills:                 misc['Навыки'] ?? '',
    damage_immunities:      misc['Иммунитет к урону'] ?? '',
    condition_immunities:   misc['Иммунитет к состоянию'] ?? '',
    damage_resistances:     misc['Сопротивление урону'] ?? '',
    damage_vulnerabilities: misc['Уязвимость к урону'] ?? '',
    senses:                 misc['Чувства'] ?? '',
    languages:              misc['Языки'] ?? '',
    challenge:              misc['Опасность'] ?? '',
    actionsText:            Array.isArray(n.actions)           ? n.actions.join('\n')            : '',
    bonusActionsText:       Array.isArray(n.bonus_actions)     ? n.bonus_actions.join('\n')      : '',
    reactionsText:          Array.isArray(n.reactions)         ? n.reactions.join('\n')          : '',
    legendaryActionsText:   Array.isArray(n.legendary_actions) ? n.legendary_actions.join('\n')  : '',
    lairActionsText:        Array.isArray(n.lair_actions)      ? n.lair_actions.join('\n')       : '',
    regionalEffectsText:    Array.isArray(n.regional_effects)  ? n.regional_effects.join('\n')   : '',
    mythicActionsText:      Array.isArray(n.mythic_actions)    ? n.mythic_actions.join('\n')     : '',
  }
}

const toLines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean)

const modStr = (raw: string | number) => {
  const n = typeof raw === 'string' ? parseInt(raw) : raw
  if (isNaN(n)) return '—'
  const m = Math.floor((n - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

const inputCls = 'w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30'
const numCls = inputCls + ' [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

const ABILITY_LABELS: { key: keyof AbilityScores; short: string }[] = [
  { key: 'str', short: 'СИЛ' },
  { key: 'dex', short: 'ЛОВ' },
  { key: 'con', short: 'ТЕЛ' },
  { key: 'int', short: 'ИНТ' },
  { key: 'wis', short: 'МУД' },
  { key: 'cha', short: 'ХАР' },
]

interface Props {
  roomCode: string
  npc?: NPC
  onClose: () => void
  onSaved: (npc: NPC) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-parchment/40 font-fantasy uppercase tracking-wider pt-1 border-t border-dark-border/50">{children}</p>
}

function OptionalTextarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-parchment/50 font-fantasy">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30 resize-none"
      />
    </div>
  )
}

export function NpcModal({ roomCode, npc, onClose, onSaved }: Props) {
  const addNpc = useGameStore((s) => s.addNpc)
  const updateNpc = useGameStore((s) => s.updateNpc)
  const [form, setForm] = useState<NpcForm>(() => npc ? fromNPC(npc) : defaultForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = <K extends keyof NpcForm>(key: K, value: NpcForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setAbility = (key: keyof AbilityScores, value: string) =>
    setForm((f) => ({ ...f, abilities: { ...f.abilities, [key]: value } }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Введите имя'); return }

    const numMaxHp = parseInt(form.max_hp)
    if (!form.max_hp || isNaN(numMaxHp) || numMaxHp < 1) {
      setError('Макс. HP: не менее 1'); return
    }

    const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
    for (const key of abilityKeys) {
      const v = parseInt(form.abilities[key])
      if (!form.abilities[key] || isNaN(v) || v < 1 || v > 30) {
        setError('Характеристики: все значения от 1 до 30'); return
      }
    }

    setSaving(true)
    setError('')
    try {
      const misc: Record<string, string> = {}
      const miscMap: [string, keyof NpcForm][] = [
        ['Особенности',         'features'],
        ['Спасброски',          'saving_throws'],
        ['Навыки',              'skills'],
        ['Иммунитет к урону',   'damage_immunities'],
        ['Иммунитет к состоянию', 'condition_immunities'],
        ['Сопротивление урону', 'damage_resistances'],
        ['Уязвимость к урону',  'damage_vulnerabilities'],
        ['Чувства',             'senses'],
        ['Языки',               'languages'],
        ['Опасность',           'challenge'],
      ]
      for (const [label, field] of miscMap) {
        const val = (form[field] as string).trim()
        if (val) misc[label] = val
      }

      const body = {
        name: form.name.trim(),
        disposition: form.disposition,
        ac: form.ac || '10',
        max_hp: numMaxHp,
        speed: form.speed,
        type_alignment: form.type_alignment,
        abilities: {
          str: parseInt(form.abilities.str),
          dex: parseInt(form.abilities.dex),
          con: parseInt(form.abilities.con),
          int: parseInt(form.abilities.int),
          wis: parseInt(form.abilities.wis),
          cha: parseInt(form.abilities.cha),
        },
        misc,
        actions:            toLines(form.actionsText),
        bonus_actions:      toLines(form.bonusActionsText),
        reactions:          toLines(form.reactionsText),
        legendary_actions:  toLines(form.legendaryActionsText),
        lair_actions:       toLines(form.lairActionsText),
        regional_effects:   toLines(form.regionalEffectsText),
        mythic_actions:     toLines(form.mythicActionsText),
      }
      let saved: NPC
      if (npc) {
        const { data } = await api.put<NPC>(`/api/v1/npcs/${npc.id}`, body)
        saved = data
        updateNpc(data)
      } else {
        const { data } = await api.post<NPC>(`/api/v1/rooms/${roomCode}/npcs`, body)
        saved = data
        addNpc(data)
      }
      onSaved(saved)
    } catch {
      setError('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-dark-card border border-dark-border rounded-lg w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
          <h2 className="font-fantasy text-gold-light text-base">{npc ? 'Редактировать НПС' : 'Новый НПС'}</h2>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment/70 w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Имя + диспозиция */}
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Имя *</label>
              <input className={inputCls} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Гоблин" autoFocus />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Диспозиция</label>
              <select
                value={form.disposition}
                onChange={(e) => setField('disposition', e.target.value as NpcForm['disposition'])}
                className="bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment"
              >
                <option value="hostile">Враг</option>
                <option value="neutral">Нейтрал</option>
                <option value="friendly">Союзник</option>
              </select>
            </div>
          </div>

          {/* Тип */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-parchment/50 font-fantasy">Тип / мировоззрение</label>
            <input className={inputCls} value={form.type_alignment} onChange={(e) => setField('type_alignment', e.target.value)} placeholder="Малый гуманоид, нейтрально-злой" />
          </div>

          {/* КД + HP + Скорость */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">КД</label>
              <input className={inputCls} value={form.ac} onChange={(e) => setField('ac', e.target.value)} placeholder="13" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Макс. HP</label>
              <input type="number" min={1} className={numCls} value={form.max_hp}
                onChange={(e) => setField('max_hp', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Скорость</label>
              <input className={inputCls} value={form.speed} onChange={(e) => setField('speed', e.target.value)} placeholder="30 фт." />
            </div>
          </div>

          {/* Характеристики */}
          <div>
            <p className="text-xs text-parchment/50 font-fantasy mb-2">Характеристики</p>
            <div className="grid grid-cols-6 gap-1.5">
              {ABILITY_LABELS.map(({ key, short }) => {
                const raw = form.abilities[key]
                const numScore = parseInt(raw)
                return (
                  <div key={key} className="bg-dark rounded border border-dark-border p-1.5 flex flex-col items-center gap-0.5">
                    <span className="text-xs text-parchment/50 font-fantasy">{short}</span>
                    <input
                      type="number" min={1} max={30}
                      value={raw}
                      onChange={(e) => setAbility(key, e.target.value)}
                      className="w-full text-center bg-transparent border-b border-dark-border text-parchment text-sm font-bold focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className={`text-xs font-mono ${!isNaN(numScore) && Math.floor((numScore - 10) / 2) >= 0 ? 'text-green-400' : 'text-ember'}`}>
                      {modStr(raw)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Действия */}
          <SectionLabel>Действия</SectionLabel>
          <OptionalTextarea label="Действия (каждое с новой строки)" value={form.actionsText}
            onChange={(v) => setField('actionsText', v)} rows={4}
            placeholder={"Укус. Рукопашная атака: +4 к попаданию, досягаемость 5 фт., 1 цель. Урон: 1к6+2.\nМультиатака. Две атаки."} />
          <OptionalTextarea label="Бонусные действия" value={form.bonusActionsText}
            onChange={(v) => setField('bonusActionsText', v)} />
          <OptionalTextarea label="Реакции" value={form.reactionsText}
            onChange={(v) => setField('reactionsText', v)} />
          <OptionalTextarea label="Легендарные действия" value={form.legendaryActionsText}
            onChange={(v) => setField('legendaryActionsText', v)} />
          <OptionalTextarea label="Мифические действия" value={form.mythicActionsText}
            onChange={(v) => setField('mythicActionsText', v)} />
          <OptionalTextarea label="Действия логова" value={form.lairActionsText}
            onChange={(v) => setField('lairActionsText', v)} />
          <OptionalTextarea label="Региональные эффекты" value={form.regionalEffectsText}
            onChange={(v) => setField('regionalEffectsText', v)} />

          {/* Дополнительные характеристики */}
          <SectionLabel>Дополнительно</SectionLabel>
          <OptionalTextarea label="Особенности" value={form.features}
            onChange={(v) => setField('features', v)} rows={3}
            placeholder="Бесстрашие. Существо имеет преимущество..." />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Спасброски</label>
              <input className={inputCls} value={form.saving_throws} onChange={(e) => setField('saving_throws', e.target.value)} placeholder="Мдр +5, Хар +7" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Навыки</label>
              <input className={inputCls} value={form.skills} onChange={(e) => setField('skills', e.target.value)} placeholder="Восприятие +4, Скрытность +6" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Иммунитет к урону</label>
              <input className={inputCls} value={form.damage_immunities} onChange={(e) => setField('damage_immunities', e.target.value)} placeholder="яд, психическая энергия" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Иммунитет к состоянию</label>
              <input className={inputCls} value={form.condition_immunities} onChange={(e) => setField('condition_immunities', e.target.value)} placeholder="испуг, очарование" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Сопротивление урону</label>
              <input className={inputCls} value={form.damage_resistances} onChange={(e) => setField('damage_resistances', e.target.value)} placeholder="огонь, холод" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Уязвимость к урону</label>
              <input className={inputCls} value={form.damage_vulnerabilities} onChange={(e) => setField('damage_vulnerabilities', e.target.value)} placeholder="дробящий" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Чувства</label>
              <input className={inputCls} value={form.senses} onChange={(e) => setField('senses', e.target.value)} placeholder="тёмное зрение 60 фт., пасс. Восприятие 12" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Языки</label>
              <input className={inputCls} value={form.languages} onChange={(e) => setField('languages', e.target.value)} placeholder="Общий, Гоблинский" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-parchment/50 font-fantasy">Опасность</label>
              <input className={inputCls} value={form.challenge} onChange={(e) => setField('challenge', e.target.value)} placeholder="1/2 (100 опыта)" />
            </div>
          </div>
        </div>

        {error && <p className="px-4 pb-1 text-ember text-xs">{error}</p>}

        <div className="flex gap-2 px-4 py-3 border-t border-dark-border shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment transition-colors">
            Отмена
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-2 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
