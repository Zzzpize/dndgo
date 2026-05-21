'use client'

import { useState } from 'react'
import { ReactNode } from 'react'
import api from '@/lib/api'
import { Character, useGameStore } from '@/store/gameStore'

type Tab = 'main' | 'stats' | 'combat' | 'abilities' | 'other'

interface Weapon {
  name: string
  attack_bonus: string
  damage: string
}

type StatKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

interface StatsForm {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  has_shield: boolean
}

interface Ability {
  name: string
  description: string
}

interface CharForm {
  name: string
  class: string
  subclass: string
  race: string
  subrace: string
  level: number
  max_hp: number
  hp: number
  temp_hp: number
  ac: number
  stats: StatsForm
  weapons: Weapon[]
  spell_slots: Record<string, number>
  abilities: Ability[]
  inventory: string
  notes: string
}

const defaultForm = (): CharForm => ({
  name: '',
  class: '',
  subclass: '',
  race: '',
  subrace: '',
  level: 1,
  max_hp: 10,
  hp: 10,
  temp_hp: 0,
  ac: 10,
  stats: {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10, has_shield: false,
  },
  weapons: [],
  spell_slots: {},
  abilities: [],
  inventory: '',
  notes: '',
})

const fromCharacter = (c: Character): CharForm => {
  const s = (c.stats as Record<string, unknown>) ?? {}
  return {
    name: c.name,
    class: c.class,
    subclass: c.subclass,
    race: c.race,
    subrace: c.subrace,
    level: c.level,
    max_hp: c.max_hp,
    hp: c.hp,
    temp_hp: c.temp_hp,
    ac: c.ac,
    stats: {
      strength: (s.strength as number) ?? 10,
      dexterity: (s.dexterity as number) ?? 10,
      constitution: (s.constitution as number) ?? 10,
      intelligence: (s.intelligence as number) ?? 10,
      wisdom: (s.wisdom as number) ?? 10,
      charisma: (s.charisma as number) ?? 10,
      has_shield: (s.has_shield as boolean) ?? false,
    },
    weapons: Array.isArray(c.weapons) ? (c.weapons as Weapon[]) : [],
    spell_slots: ((c.spell_slots as Record<string, number>) ?? {}),
    abilities: Array.isArray(c.abilities) ? (c.abilities as Ability[]) : [],
    inventory: c.inventory,
    notes: c.notes,
  }
}

const modStr = (score: number) => {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

interface Props {
  roomCode: string
  character?: Character
  onClose: () => void
  onSaved: (char: Character) => void
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'main', label: 'Основное' },
  { key: 'stats', label: 'Хар-ки' },
  { key: 'combat', label: 'Оружие' },
  { key: 'abilities', label: 'Способности' },
  { key: 'other', label: 'Прочее' },
]

const inputCls = 'w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30'
const numCls = inputCls + ' [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-parchment/50 font-fantasy">{label}</label>
      {children}
    </div>
  )
}

export function CharacterModal({ roomCode, character, onClose, onSaved }: Props) {
  const addCharacter = useGameStore((s) => s.addCharacter)
  const updateCharacter = useGameStore((s) => s.updateCharacter)
  const [tab, setTab] = useState<Tab>('main')
  const [form, setForm] = useState<CharForm>(() =>
    character ? fromCharacter(character) : defaultForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = <K extends keyof CharForm>(key: K, value: CharForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setStat = (key: keyof StatsForm, value: number | boolean) =>
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: value } }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Введите имя персонажа'); return }
    setSaving(true)
    setError('')
    try {
      let saved: Character
      if (character) {
        const { data } = await api.put<Character>(`/api/v1/characters/${character.id}`, form)
        saved = data
        updateCharacter(data)
      } else {
        const { data } = await api.post<Character>(`/api/v1/rooms/${roomCode}/characters`, form)
        saved = data
        addCharacter(data)
      }
      onSaved(saved)
    } catch {
      setError('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border rounded-lg w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
          <h2 className="font-fantasy text-gold-light text-base">
            {character ? 'Редактировать персонажа' : 'Новый персонаж'}
          </h2>
          <button
            onClick={onClose}
            className="text-parchment/40 hover:text-parchment/70 w-7 h-7 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-dark-border shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-xs font-fantasy transition-colors ${
                tab === key
                  ? 'text-gold-light border-b-2 border-gold'
                  : 'text-parchment/40 hover:text-parchment/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {tab === 'main' && <MainTab form={form} setField={setField} setStat={setStat} />}
          {tab === 'stats' && <StatsTab stats={form.stats} setStat={setStat} />}
          {tab === 'combat' && <CombatTab form={form} setField={setField} />}
          {tab === 'abilities' && <AbilitiesTab form={form} setField={setField} />}
          {tab === 'other' && <OtherTab form={form} setField={setField} />}
        </div>

        {error && <p className="px-4 pb-1 text-ember text-xs">{error}</p>}

        <div className="flex gap-2 px-4 py-3 border-t border-dark-border shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment transition-colors"
          >
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

// ─── Sub-tab components ─────────────────────────────────────────────────────

const STAT_LABELS: { key: StatKey; short: string }[] = [
  { key: 'strength', short: 'СИЛ' },
  { key: 'dexterity', short: 'ЛОВ' },
  { key: 'constitution', short: 'ТЕЛ' },
  { key: 'intelligence', short: 'ИНТ' },
  { key: 'wisdom', short: 'МУД' },
  { key: 'charisma', short: 'ХАР' },
]

function MainTab({
  form,
  setField,
  setStat,
}: {
  form: CharForm
  setField: <K extends keyof CharForm>(k: K, v: CharForm[K]) => void
  setStat: (k: keyof StatsForm, v: number | boolean) => void
}) {
  return (
    <>
      <Field label="Имя *">
        <input
          className={inputCls}
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Имя персонажа"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Класс">
          <input className={inputCls} value={form.class} onChange={(e) => setField('class', e.target.value)} placeholder="Воин" />
        </Field>
        <Field label="Подкласс">
          <input className={inputCls} value={form.subclass} onChange={(e) => setField('subclass', e.target.value)} placeholder="Чемпион" />
        </Field>
        <Field label="Раса">
          <input className={inputCls} value={form.race} onChange={(e) => setField('race', e.target.value)} placeholder="Человек" />
        </Field>
        <Field label="Подраса">
          <input className={inputCls} value={form.subrace} onChange={(e) => setField('subrace', e.target.value)} placeholder="Вариант" />
        </Field>
      </div>
      <Field label="Уровень">
        <input
          type="number" min={1} max={20}
          className={numCls}
          value={form.level}
          onChange={(e) => setField('level', Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Макс. HP">
          <input type="number" min={1} className={numCls} value={form.max_hp}
            onChange={(e) => setField('max_hp', parseInt(e.target.value) || 1)} />
        </Field>
        <Field label="HP">
          <input type="number" min={0} className={numCls} value={form.hp}
            onChange={(e) => setField('hp', Math.max(0, parseInt(e.target.value) || 0))} />
        </Field>
        <Field label="Врем. HP">
          <input type="number" min={0} className={numCls} value={form.temp_hp}
            onChange={(e) => setField('temp_hp', Math.max(0, parseInt(e.target.value) || 0))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="КД">
          <input type="number" min={1} className={numCls} value={form.ac}
            onChange={(e) => setField('ac', parseInt(e.target.value) || 10)} />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-parchment/50 font-fantasy">Щит (+2 КД)</span>
          <label className="flex items-center gap-2 cursor-pointer h-[30px]">
            <input
              type="checkbox"
              checked={form.stats.has_shield}
              onChange={(e) => setStat('has_shield', e.target.checked)}
              className="accent-gold w-3.5 h-3.5"
            />
            <span className="text-xs text-parchment">Есть щит</span>
          </label>
        </div>
      </div>
    </>
  )
}

function StatsTab({
  stats,
  setStat,
}: {
  stats: StatsForm
  setStat: (k: keyof StatsForm, v: number | boolean) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {STAT_LABELS.map(({ key, short }) => {
        const score = stats[key]
        return (
          <div key={key} className="bg-dark rounded border border-dark-border p-2 flex flex-col items-center gap-1">
            <span className="text-xs text-parchment/50 font-fantasy">{short}</span>
            <input
              type="number" min={1} max={30}
              value={score}
              onChange={(e) => setStat(key, parseInt(e.target.value) || 10)}
              className="w-16 text-center bg-transparent border-b border-dark-border text-parchment text-lg font-bold focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className={`text-xs font-mono ${Math.floor((score - 10) / 2) >= 0 ? 'text-green-400' : 'text-ember'}`}>
              {modStr(score)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CombatTab({
  form,
  setField,
}: {
  form: CharForm
  setField: <K extends keyof CharForm>(k: K, v: CharForm[K]) => void
}) {
  const addWeapon = () =>
    setField('weapons', [...form.weapons, { name: '', attack_bonus: '', damage: '' }])
  const updateWeapon = (i: number, f: keyof Weapon, v: string) =>
    setField('weapons', form.weapons.map((w, idx) => (idx === i ? { ...w, [f]: v } : w)))
  const removeWeapon = (i: number) =>
    setField('weapons', form.weapons.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-fantasy text-parchment/50">Оружие</span>
          <button
            onClick={addWeapon}
            className="text-xs px-2 py-0.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light transition-colors"
          >
            + Добавить
          </button>
        </div>
        {form.weapons.length === 0 && (
          <p className="text-parchment/30 text-xs text-center py-2">Нет оружия</p>
        )}
        <div className="flex flex-col gap-1.5">
          {form.weapons.map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={w.name}
                onChange={(e) => updateWeapon(i, 'name', e.target.value)}
                placeholder="Название"
                className="flex-1 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30"
              />
              <input
                value={w.attack_bonus}
                onChange={(e) => updateWeapon(i, 'attack_bonus', e.target.value)}
                placeholder="+5"
                className="w-12 bg-dark border border-dark-border rounded px-1 py-1 text-xs text-parchment text-center placeholder-parchment/30"
              />
              <input
                value={w.damage}
                onChange={(e) => updateWeapon(i, 'damage', e.target.value)}
                placeholder="1к8+3"
                className="w-16 bg-dark border border-dark-border rounded px-1 py-1 text-xs text-parchment text-center placeholder-parchment/30"
              />
              <button
                onClick={() => removeWeapon(i)}
                className="text-ember/50 hover:text-ember text-xs w-5 h-5 flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-dark-border" />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-fantasy text-parchment/50">Ячейки заклинаний</span>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((lvl) => (
            <div key={lvl} className="flex items-center gap-2">
              <span className="text-xs text-parchment/40 w-10 shrink-0">Ур. {lvl}</span>
              <input
                type="number" min={0} max={9}
                value={form.spell_slots[lvl] ?? 0}
                onChange={(e) =>
                  setField('spell_slots', {
                    ...form.spell_slots,
                    [lvl]: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-10 bg-dark border border-dark-border rounded px-1 py-1 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AbilitiesTab({
  form,
  setField,
}: {
  form: CharForm
  setField: <K extends keyof CharForm>(k: K, v: CharForm[K]) => void
}) {
  const addAbility = () =>
    setField('abilities', [...form.abilities, { name: '', description: '' }])
  const updateAbility = (i: number, f: keyof Ability, v: string) =>
    setField('abilities', form.abilities.map((a, idx) => (idx === i ? { ...a, [f]: v } : a)))
  const removeAbility = (i: number) =>
    setField('abilities', form.abilities.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-fantasy text-parchment/50">Способности и черты</span>
        <button
          onClick={addAbility}
          className="text-xs px-2 py-0.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light transition-colors"
        >
          + Добавить
        </button>
      </div>
      {form.abilities.length === 0 && (
        <p className="text-parchment/30 text-xs text-center py-2">Нет способностей</p>
      )}
      <div className="flex flex-col gap-3">
        {form.abilities.map((a, i) => (
          <div key={i} className="flex flex-col gap-1 bg-dark rounded border border-dark-border p-2">
            <div className="flex items-center gap-1">
              <input
                value={a.name}
                onChange={(e) => updateAbility(i, 'name', e.target.value)}
                placeholder="Название способности"
                className="flex-1 bg-transparent border-b border-dark-border text-xs text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold pb-0.5"
              />
              <button
                onClick={() => removeAbility(i)}
                className="text-ember/50 hover:text-ember text-xs w-5 h-5 flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            </div>
            <textarea
              value={a.description}
              onChange={(e) => updateAbility(i, 'description', e.target.value)}
              placeholder="Описание..."
              rows={3}
              className="w-full bg-transparent text-xs text-parchment/80 placeholder-parchment/30 resize-none focus:outline-none mt-1"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function OtherTab({
  form,
  setField,
}: {
  form: CharForm
  setField: <K extends keyof CharForm>(k: K, v: CharForm[K]) => void
}) {
  return (
    <>
      <Field label="Инвентарь">
        <textarea
          value={form.inventory}
          onChange={(e) => setField('inventory', e.target.value)}
          placeholder="Список предметов..."
          rows={5}
          className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30 resize-none"
        />
      </Field>
      <Field label="Заметки">
        <textarea
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Биография, особенности..."
          rows={5}
          className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30 resize-none"
        />
      </Field>
    </>
  )
}
