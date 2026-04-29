'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore, InitiativeEntry } from '@/store/gameStore'
import api from '@/lib/api'

interface Props {
  sendMessage: (type: string, payload?: unknown) => void
  roomCode: string
}

type Tab = 'tokens' | 'bestiary' | 'initiative' | 'map'

interface Monster {
  id: number
  name_ru: string
  name_en: string
  armor_class: string
  hit_points: string
  type_and_alignment: string
}

export function DMPanel({ sendMessage, roomCode }: Props) {
  const [tab, setTab] = useState<Tab>('tokens')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tokens', label: 'Токены' },
    { key: 'bestiary', label: 'Бестиарий' },
    { key: 'initiative', label: 'Инициатива' },
    { key: 'map', label: 'Карта' },
  ]

  return (
    <div className="w-72 border-l border-dark-border bg-dark-card flex flex-col overflow-hidden shrink-0">
      <div className="flex border-b border-dark-border shrink-0">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-fantasy transition-colors ${
              tab === key
                ? 'text-gold-light border-b-2 border-gold bg-dark/30'
                : 'text-parchment/40 hover:text-parchment/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'tokens' && <TokensTab sendMessage={sendMessage} />}
        {tab === 'bestiary' && <BestiaryTab sendMessage={sendMessage} />}
        {tab === 'initiative' && <InitiativeTab sendMessage={sendMessage} />}
        {tab === 'map' && <MapTab sendMessage={sendMessage} roomCode={roomCode} />}
      </div>
    </div>
  )
}


function TokensTab({ sendMessage }: { sendMessage: Props['sendMessage'] }) {
  const tokens = useGameStore((s) => s.tokens)
  const characters = useGameStore((s) => s.characters)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [tokenType, setTokenType] = useState<'pc' | 'npc'>('npc')
  const [disposition, setDisposition] = useState<'friendly' | 'neutral' | 'hostile'>('hostile')
  const [charId, setCharId] = useState('')

  const handleAdd = () => {
    if (!name.trim()) return
    sendMessage('TOKEN_CREATE', {
      token_type: tokenType,
      character_id: charId || undefined,
      name: name.trim(),
      rel_x: 0.5,
      rel_y: 0.5,
      disposition,
    })
    setName('')
    setCharId('')
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    sendMessage('TOKEN_DELETE', { id })
  }

  const DISP_COLOR: Record<string, string> = {
    friendly: 'text-gold',
    neutral: 'text-steel-light',
    hostile: 'text-ember',
  }
  const DISP_LABEL: Record<string, string> = {
    friendly: 'союзник',
    neutral: 'нейтрал',
    hostile: 'враг',
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-parchment/50 text-xs font-fantasy">На карте ({tokens.length})</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-2 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light font-fantasy transition-colors"
        >
          + Добавить
        </button>
      </div>

      {showForm && (
        <div className="bg-dark border border-dark-border rounded p-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя токена"
            className="w-full bg-dark-card border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30"
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value as 'pc' | 'npc')}
              className="flex-1 bg-dark-card border border-dark-border rounded px-2 py-1.5 text-xs text-parchment"
            >
              <option value="npc">НПС</option>
              <option value="pc">Персонаж</option>
            </select>
            <select
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as typeof disposition)}
              className="flex-1 bg-dark-card border border-dark-border rounded px-2 py-1.5 text-xs text-parchment"
            >
              <option value="friendly">Союзник</option>
              <option value="neutral">Нейтрал</option>
              <option value="hostile">Враг</option>
            </select>
          </div>
          {tokenType === 'pc' && characters.length > 0 && (
            <select
              value={charId}
              onChange={(e) => setCharId(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded px-2 py-1.5 text-xs text-parchment"
            >
              <option value="">— Без привязки —</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 py-1.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
            >
              Разместить
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-parchment/40 hover:text-parchment/70 text-xs transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {tokens.length === 0 && (
          <p className="text-parchment/30 text-xs text-center py-4">Токенов нет</p>
        )}
        {tokens.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded bg-dark border border-dark-border/50 hover:border-dark-border"
          >
            <span className={`text-xs ${DISP_COLOR[t.disposition]}`}>●</span>
            <span className="flex-1 text-xs text-parchment truncate">{t.name}</span>
            <span className="text-parchment/30 text-xs">{DISP_LABEL[t.disposition]}</span>
            <button
              onClick={() => handleDelete(t.id)}
              className="text-ember/50 hover:text-ember text-xs w-5 h-5 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}


function BestiaryTab({ sendMessage }: { sendMessage: Props['sendMessage'] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Monster[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      api
        .get<{ monsters: Monster[]; total: number }>(`/api/v1/bestiary?q=${encodeURIComponent(query)}&limit=15`)
        .then(({ data }) => setResults(data.monsters ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const placeMonster = (m: Monster) => {
    sendMessage('TOKEN_CREATE', {
      token_type: 'npc',
      name: m.name_ru,
      rel_x: 0.5,
      rel_y: 0.5,
      disposition: 'hostile',
    })
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск монстра..."
        className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30"
        autoFocus
      />

      {loading && (
        <p className="text-parchment/30 text-xs text-center animate-pulse">Поиск...</p>
      )}

      <div className="flex flex-col gap-1">
        {results.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 px-2 py-2 rounded bg-dark border border-dark-border/50 hover:border-dark-border group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-parchment truncate">{m.name_ru}</p>
              <p className="text-parchment/30 text-xs truncate">
                КД {m.armor_class} · {m.hit_points} хп
              </p>
            </div>
            <button
              onClick={() => placeMonster(m)}
              className="text-xs px-2 py-0.5 bg-ember/20 hover:bg-ember/30 border border-ember/30 rounded text-ember opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              + карта
            </button>
          </div>
        ))}
        {!loading && query && results.length === 0 && (
          <p className="text-parchment/30 text-xs text-center py-4">Не найдено</p>
        )}
      </div>
    </div>
  )
}

function InitiativeTab({ sendMessage }: { sendMessage: Props['sendMessage'] }) {
  const gameState = useGameStore((s) => s.gameState)
  const characters = useGameStore((s) => s.characters)
  const activeInitIndex = useGameStore((s) => s.activeInitIndex)
  const [entries, setEntries] = useState<InitiativeEntry[]>([])
  const inCombat = (gameState?.initiative_order ?? []).length > 0

  const fromChars = () => {
    setEntries(
      characters.map((c) => ({ character_id: c.id, name: c.name, initiative: 0 }))
    )
  }

  const updateEntry = (i: number, field: keyof InitiativeEntry, value: string | number) => {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }

  const addEntry = () => {
    setEntries((prev) => [...prev, { name: '', initiative: 0 }])
  }

  const removeEntry = (i: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== i))
  }

  const startCombat = () => {
    const sorted = [...entries].sort((a, b) => b.initiative - a.initiative)
    sendMessage('INIT_UPDATE', sorted)
  }

  const order = gameState?.initiative_order ?? []

  return (
    <div className="p-3 flex flex-col gap-3">
      {inCombat ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-fantasy text-gold-light">Бой идёт</span>
            <div className="flex gap-1">
              <button
                onClick={() => sendMessage('INIT_NEXT')}
                className="text-xs px-2 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light transition-colors"
              >
                Следующий
              </button>
              <button
                onClick={() => sendMessage('INIT_END')}
                className="text-xs px-2 py-1 bg-ember/20 hover:bg-ember/30 border border-ember/30 rounded text-ember transition-colors"
              >
                Завершить
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {order.map((e, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border ${
                  i === activeInitIndex % order.length
                    ? 'bg-gold/10 border-gold/40 text-gold-light'
                    : 'bg-dark border-dark-border/50 text-parchment'
                }`}
              >
                {i === activeInitIndex % order.length && (
                  <span className="text-gold-light text-xs">▶</span>
                )}
                <span className="flex-1 text-xs truncate">{e.name}</span>
                <span className="text-parchment/50 text-xs font-mono">{e.initiative}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-fantasy text-parchment/50">Настройка инициативы</span>
            <button
              onClick={fromChars}
              className="text-xs px-2 py-1 bg-dark hover:bg-dark-hover border border-dark-border rounded text-parchment/60 hover:text-parchment transition-colors"
            >
              Из персонажей
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  value={e.name}
                  onChange={(ev) => updateEntry(i, 'name', ev.target.value)}
                  placeholder="Имя"
                  className="flex-1 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30"
                />
                <input
                  type="number"
                  value={e.initiative || ''}
                  onChange={(ev) => updateEntry(i, 'initiative', parseInt(ev.target.value) || 0)}
                  placeholder="0"
                  className="w-12 bg-dark border border-dark-border rounded px-1 py-1 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => removeEntry(i)}
                  className="text-ember/50 hover:text-ember text-xs w-5 h-5 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={addEntry}
              className="flex-1 py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment transition-colors"
            >
              + Добавить
            </button>
            {entries.length > 0 && (
              <button
                onClick={startCombat}
                className="flex-1 py-1.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
              >
                Начать бой
              </button>
            )}
          </div>
          {entries.length === 0 && (
            <p className="text-parchment/30 text-xs text-center py-2">
              Добавьте участников или загрузите из персонажей
            </p>
          )}
        </>
      )}
    </div>
  )
}


function MapTab({ sendMessage, roomCode }: { sendMessage: Props['sendMessage']; roomCode: string }) {
  const gameState = useGameStore((s) => s.gameState)
  const [gridEnabled, setGridEnabled] = useState(gameState?.grid_enabled ?? true)
  const [gridSize, setGridSize] = useState(gameState?.grid_size ?? 50)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('map', file)
      await api.post(`/api/v1/rooms/${roomCode}/map`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    } catch {
      setUploadError('Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const applyGrid = () => {
    sendMessage('GRID_UPDATE', { grid_enabled: gridEnabled, grid_size: gridSize })
  }

  return (
    <div className="p-3 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-fantasy text-parchment/50">Загрузить карту</p>
        <label
          className={`flex items-center justify-center gap-2 w-full py-2 border border-dashed rounded cursor-pointer transition-colors ${
            uploading
              ? 'border-gold/30 text-gold/50'
              : 'border-dark-border hover:border-gold/40 text-parchment/50 hover:text-parchment/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <span className="text-xs animate-pulse">Загрузка...</span>
          ) : (
            <span className="text-xs">Выбрать файл (jpg, png, webp)</span>
          )}
        </label>
        {uploadError && (
          <p className="text-ember text-xs">{uploadError}</p>
        )}
      </div>

      <hr className="border-dark-border" />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-fantasy text-parchment/50">Сетка</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gridEnabled}
            onChange={(e) => setGridEnabled(e.target.checked)}
            className="accent-gold w-3.5 h-3.5"
          />
          <span className="text-xs text-parchment">Показывать сетку</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-parchment/50 w-20">Размер клетки</span>
          <input
            type="number"
            value={gridSize}
            min={20}
            max={200}
            onChange={(e) => setGridSize(parseInt(e.target.value) || 50)}
            className="w-16 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-parchment/30">px</span>
        </div>
        <button
          onClick={applyGrid}
          className="w-full py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment font-fantasy transition-colors"
        >
          Применить сетку
        </button>
      </div>
    </div>
  )
}
