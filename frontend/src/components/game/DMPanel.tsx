'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore, InitiativeEntry, Character, NPC } from '@/store/gameStore'
import { parseMaxHP } from '@/lib/maxhp'
import { CharacterModal } from '@/components/character/CharacterModal'
import { NpcModal } from '@/components/game/NpcModal'
import api from '@/lib/api'

interface Props {
  sendMessage: (type: string, payload?: unknown) => void
  roomCode: string
}

type Tab = 'queue' | 'tokens' | 'npc' | 'initiative' | 'map' | 'chars'

interface Monster {
  id: number
  name_ru: string
  name_en: string
  armor_class: string
  hit_points: string
  type_and_alignment: string
}

interface PoolEntry {
  _key: string
  token_type: 'pc' | 'npc'
  character_id?: string
  npc_id?: string
  bestiary_id?: number
  name: string
  disposition: 'friendly' | 'neutral' | 'hostile'
  max_hp?: string
  current_hp?: number
  size?: number
  subtitle?: string
}

const DISP_DOT: Record<string, string> = {
  friendly: 'text-token-friendly',
  neutral: 'text-token-neutral',
  hostile: 'text-token-hostile',
}

export function DMPanel({ sendMessage, roomCode }: Props) {
  const [tab, setTab] = useState<Tab>('queue')
  const [pool, setPool] = useState<PoolEntry[]>([])

  const addToPool = (entry: Omit<PoolEntry, '_key'>) => {
    setPool((p) => [...p, { ...entry, _key: `${Date.now()}-${Math.random()}` }])
  }

  const removeFromPool = (key: string) => {
    setPool((p) => p.filter((e) => e._key !== key))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'queue', label: `Очередь${pool.length > 0 ? ` (${pool.length})` : ''}` },
    { key: 'tokens', label: 'Токены' },
    { key: 'npc', label: 'НПС' },
    { key: 'initiative', label: 'Бой' },
    { key: 'map', label: 'Карта' },
    { key: 'chars', label: 'Персонажи' },
  ]

  return (
    <div className="w-full md:w-72 h-full border-l border-dark-border bg-dark-card flex flex-col overflow-hidden shrink-0">
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
        {tab === 'queue' && <QueueTab pool={pool} onRemove={removeFromPool} onAdd={addToPool} />}
        {tab === 'tokens' && <TokensTab sendMessage={sendMessage} />}
        {tab === 'npc' && <NpcTab roomCode={roomCode} onAddToPool={addToPool} />}
        {tab === 'initiative' && <InitiativeTab sendMessage={sendMessage} />}
        {tab === 'map' && <MapTab sendMessage={sendMessage} roomCode={roomCode} />}
        {tab === 'chars' && <CharsTab roomCode={roomCode} onAddToPool={addToPool} sendMessage={sendMessage} />}
      </div>
    </div>
  )
}


function QueueTab({
  pool,
  onRemove,
  onAdd,
}: {
  pool: PoolEntry[]
  onRemove: (key: string) => void
  onAdd: (entry: Omit<PoolEntry, '_key'>) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [disposition, setDisposition] = useState<'friendly' | 'neutral' | 'hostile'>('hostile')

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({
      token_type: 'npc',
      name: name.trim(),
      disposition,
      subtitle: disposition === 'hostile' ? 'враг' : disposition === 'friendly' ? 'друг' : 'нейтрал',
    })
    setName('')
    setShowForm(false)
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-parchment/50 text-xs font-fantasy">
          Перетащите на карту в нужное место
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-2 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light font-fantasy transition-colors shrink-0"
        >
          + Массовка
        </button>
      </div>

      {showForm && (
        <div className="bg-dark border border-dark-border rounded p-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Имя (Гоблин, Стражник...)"
            className="w-full bg-dark-card border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30"
            autoFocus
          />
          <select
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as typeof disposition)}
            className="w-full bg-dark-card border border-dark-border rounded px-2 py-1.5 text-xs text-parchment"
          >
            <option value="hostile">Враг</option>
            <option value="neutral">Нейтрал</option>
            <option value="friendly">Друг</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 py-1.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
            >
              В очередь
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

      {pool.length === 0 ? (
        <p className="text-parchment/25 text-xs text-center py-6">
          Добавьте НПС или персонажей через вкладки НПС и Персонажи
        </p>
      ) : (
        pool.map((entry) => (
          <div
            key={entry._key}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData('application/json', JSON.stringify({
                token_type: entry.token_type,
                character_id: entry.character_id,
                npc_id: entry.npc_id,
                bestiary_id: entry.bestiary_id,
                name: entry.name,
                disposition: entry.disposition,
                max_hp: entry.max_hp,
                current_hp: entry.current_hp,
                size: entry.size,
              }))
            }}
            className="flex items-center gap-2 px-2 py-2 rounded bg-dark border border-dark-border/50 hover:border-dark-border cursor-grab active:cursor-grabbing"
          >
            <span className={`text-xs shrink-0 ${DISP_DOT[entry.disposition]}`}>●</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-parchment truncate">{entry.name}</p>
              {entry.subtitle && (
                <p className="text-parchment/30 text-xs truncate">{entry.subtitle}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(entry._key)}
              className="text-parchment/30 hover:text-ember text-xs w-5 h-5 flex items-center justify-center shrink-0 transition-colors"
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  )
}


function TokensTab({ sendMessage }: { sendMessage: Props['sendMessage'] }) {
  const tokens = useGameStore((s) => s.tokens)
  const selectedTokenId = useGameStore((s) => s.selectedTokenId)
  const setSelectedToken = useGameStore((s) => s.setSelectedToken)
  const setSelectedChar = useGameStore((s) => s.setSelectedChar)

  const DISP_COLOR: Record<string, string> = {
    friendly: 'text-token-friendly',
    neutral: 'text-token-neutral',
    hostile: 'text-token-hostile',
  }
  const DISP_LABEL: Record<string, string> = {
    friendly: 'друг',
    neutral: 'нейтрал',
    hostile: 'враг',
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <span className="text-parchment/50 text-xs font-fantasy">На карте ({tokens.length})</span>
      <div className="flex flex-col gap-1">
        {tokens.length === 0 && (
          <p className="text-parchment/30 text-xs text-center py-4">Токенов нет</p>
        )}
        {tokens.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              setSelectedToken(t.id)
              setSelectedChar(t.character_id ?? null)
            }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors ${
              selectedTokenId === t.id
                ? 'bg-gold/10 border-gold/40'
                : 'bg-dark border-dark-border/50 hover:border-dark-border'
            }`}
          >
            <span className={`text-xs ${t.token_type === 'pc' ? 'text-token-pc' : DISP_COLOR[t.disposition]}`}>●</span>
            <span className="flex-1 text-xs text-parchment truncate">{t.name}</span>
            <span className="text-parchment/30 text-xs">{DISP_LABEL[t.disposition]}</span>
            <button
              onClick={(e) => { e.stopPropagation(); sendMessage('TOKEN_DELETE', { id: t.id }) }}
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


function FolderPicker({
  npc,
  onClose,
}: {
  npc: NPC
  onClose: () => void
}) {
  const folders = useGameStore((s) => s.npcFolders)
  const setNpcFolder = useGameStore((s) => s.setNpcFolder)
  const addNpcFolder = useGameStore((s) => s.addNpcFolder)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const assign = async (folderId: string | null) => {
    setBusy(true)
    try {
      await api.patch(`/api/v1/npcs/${npc.id}/folder`, { folder_id: folderId })
      setNpcFolder(npc.id, folderId)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const createFolder = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    try {
      const { data } = await api.post(`/api/v1/rooms/${npc.room_id}/npc-folders`, { name })
      addNpcFolder(data)
      await api.patch(`/api/v1/npcs/${npc.id}/folder`, { folder_id: data.id })
      setNpcFolder(npc.id, data.id)
      onClose()
    } finally {
      setBusy(false)
      setNewName('')
      setCreating(false)
    }
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-dark-card border border-dark-border rounded shadow-xl w-44 flex flex-col overflow-hidden">
      <p className="px-2 py-1.5 text-parchment/40 text-xs font-fantasy border-b border-dark-border">Переместить в папку</p>
      <button
        onClick={() => assign(null)}
        disabled={busy}
        className={`px-3 py-1.5 text-left text-xs transition-colors hover:bg-dark ${!npc.folder_id ? 'text-gold-light' : 'text-parchment/60'}`}
      >
        — Без папки
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          onClick={() => assign(f.id)}
          disabled={busy}
          className={`px-3 py-1.5 text-left text-xs transition-colors hover:bg-dark truncate ${npc.folder_id === f.id ? 'text-gold-light' : 'text-parchment/80'}`}
        >
          {npc.folder_id === f.id ? '✓ ' : ''}{f.name}
        </button>
      ))}
      <div className="border-t border-dark-border">
        {creating ? (
          <div className="flex gap-1 p-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreating(false); setNewName('') }}}
              placeholder="Название папки"
              className="flex-1 bg-dark border border-dark-border rounded px-1.5 py-1 text-xs text-parchment placeholder-parchment/30 min-w-0"
            />
            <button onClick={createFolder} disabled={busy || !newName.trim()} className="text-xs px-2 py-1 bg-gold/20 border border-gold/30 rounded text-gold-light disabled:opacity-40">✓</button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full px-3 py-1.5 text-left text-xs text-parchment/50 hover:text-parchment hover:bg-dark transition-colors"
          >
            + Создать папку
          </button>
        )}
      </div>
    </div>
  )
}

function NpcCard({
  npc,
  onEdit,
  onDelete,
  onAddToPool,
}: {
  npc: NPC
  onEdit: () => void
  onDelete: () => void
  onAddToPool: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData('application/json', JSON.stringify({
          token_type: 'npc',
          npc_id: npc.id,
          name: npc.name,
          disposition: npc.disposition,
          max_hp: npc.max_hp,
          current_hp: parseMaxHP(npc.max_hp).numeric,
          size: npc.size ?? 1,
        }))
      }}
      className="relative flex items-center gap-2 px-2 py-2 rounded bg-dark border border-dark-border/50 hover:border-dark-border group cursor-grab active:cursor-grabbing"
    >
      <span className={`text-xs shrink-0 ${DISP_DOT[npc.disposition]}`}>●</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-parchment truncate">{npc.name}</p>
        <p className="text-parchment/30 text-xs">КД {npc.ac} · {npc.max_hp} хп</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="text-parchment/40 hover:text-gold-light text-sm w-5 h-5 flex items-center justify-center"
          title="Редактировать"
        >✎</button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setPickerOpen((v) => !v) }}
            className="text-parchment/40 hover:text-gold-light text-xs w-5 h-5 flex items-center justify-center"
            title="Папка"
          >📁</button>
          {pickerOpen && <FolderPicker npc={npc} onClose={() => setPickerOpen(false)} />}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToPool() }}
          className="text-xs px-1.5 py-0.5 bg-ember/20 hover:bg-ember/30 border border-ember/30 rounded text-ember transition-colors"
        >+ очередь</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-ember/40 hover:text-ember text-xs w-5 h-5 flex items-center justify-center"
        >✕</button>
      </div>
    </div>
  )
}

function NpcTab({
  roomCode,
  onAddToPool,
}: {
  roomCode: string
  onAddToPool: (entry: Omit<PoolEntry, '_key'>) => void
}) {
  const npcs = useGameStore((s) => s.npcs)
  const folders = useGameStore((s) => s.npcFolders)
  const removeNpc = useGameStore((s) => s.removeNpc)
  const addNpc = useGameStore((s) => s.addNpc)
  const removeNpcFolder = useGameStore((s) => s.removeNpcFolder)
  const addNpcFolder = useGameStore((s) => s.addNpcFolder)
  const [modalOpen, setModalOpen] = useState(false)
  const [editNpc, setEditNpc] = useState<NPC | null>(null)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ all: false, recent: true, none: true })
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [npcSearch, setNpcSearch] = useState('')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Monster[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
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

  const handleDelete = async (n: NPC) => {
    await api.delete(`/api/v1/npcs/${n.id}`)
    removeNpc(n.id)
  }

  const handleDeleteFolder = async (id: string) => {
    await api.delete(`/api/v1/npc-folders/${id}`)
    removeNpcFolder(id)
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    const { data } = await api.post(`/api/v1/rooms/${roomCode}/npc-folders`, { name })
    addNpcFolder(data)
    setNewFolderName('')
    setCreatingFolder(false)
    setOpenFolders((f) => ({ ...f, [data.id]: true }))
  }

  const ensureBestiaryFolder = async (): Promise<string | undefined> => {
    const existing = folders.find((f) => f.name === 'Из бестиария')
    if (existing) return existing.id
    const { data } = await api.post(`/api/v1/rooms/${roomCode}/npc-folders`, { name: 'Из бестиария' })
    addNpcFolder(data)
    setOpenFolders((f) => ({ ...f, [data.id]: true }))
    return data.id
  }

  const copyToNpcs = async (m: Monster) => {
    const folderId = await ensureBestiaryFolder()
    const { data: npc } = await api.post(`/api/v1/rooms/${roomCode}/npcs/from-bestiary`, {
      monster_id: m.id,
      folder_id: folderId,
    })
    addNpc(npc)
  }

  const openCreate = () => { setEditNpc(null); setModalOpen(true) }
  const openEdit = (n: NPC) => { setEditNpc(n); setModalOpen(true) }

  const addToPool = (n: NPC) => onAddToPool({
    token_type: 'npc', npc_id: n.id, name: n.name,
    disposition: n.disposition, max_hp: n.max_hp, current_hp: parseMaxHP(n.max_hp).numeric,
    size: n.size ?? 1,
    subtitle: `КД ${n.ac} · ${n.max_hp} хп`,
  })

  const toggleFolder = (key: string) =>
    setOpenFolders((f) => ({ ...f, [key]: !f[key] }))

  const TWO_HOURS = 2 * 60 * 60 * 1000
  const recentNpcs = npcs.filter(
    (n) => !n.folder_id && Date.now() - new Date(n.created_at).getTime() < TWO_HOURS
  )
  const noFolderNpcs = npcs.filter(
    (n) => !n.folder_id && Date.now() - new Date(n.created_at).getTime() >= TWO_HOURS
  )

  const renderFolderSection = (
    key: string,
    label: string,
    items: NPC[],
    extra?: React.ReactNode,
  ) => (
    <div key={key} className="flex flex-col group/folder">
      <div className="flex items-center gap-1.5 py-1 px-1">
        <button
          onClick={() => toggleFolder(key)}
          className="flex items-center gap-1.5 flex-1 text-parchment/50 hover:text-parchment/80 transition-colors text-left min-w-0"
        >
          <span className="text-parchment/30 text-xs">{openFolders[key] ? '▾' : '▸'}</span>
          <span className="text-xs font-fantasy truncate">{label}</span>
          {items.length > 0 && <span className="text-parchment/25 text-xs ml-1">{items.length}</span>}
        </button>
        {extra}
      </div>
      {openFolders[key] && (
        <div className="flex flex-col gap-1 pl-2">
          {items.length === 0 && (
            <p className="text-parchment/20 text-xs py-1 pl-1">Пусто</p>
          )}
          {items.map((n) => (
            <NpcCard
              key={n.id}
              npc={n}
              onEdit={() => openEdit(n)}
              onDelete={() => handleDelete(n)}
              onAddToPool={() => addToPool(n)}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-parchment/50 text-xs font-fantasy">Свои НПС ({npcs.length})</span>
        <div className="flex gap-1">
          {!creatingFolder && (
            <button
              onClick={() => setCreatingFolder(true)}
              className="text-xs px-2 py-1 bg-dark hover:bg-dark-hover border border-dark-border rounded text-parchment/50 hover:text-parchment transition-colors"
              title="Новая папка"
            >
              📁+
            </button>
          )}
          <button
            onClick={openCreate}
            className="text-xs px-2 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light font-fantasy transition-colors"
          >
            + Создать
          </button>
        </div>
      </div>

      {creatingFolder && (
        <div className="flex gap-1">
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') }}}
            placeholder="Название папки"
            className="flex-1 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30"
          />
          <button onClick={handleCreateFolder} className="text-xs px-2 py-1 bg-gold/20 border border-gold/30 rounded text-gold-light">✓</button>
          <button onClick={() => { setCreatingFolder(false); setNewFolderName('') }} className="text-xs px-2 py-1 text-parchment/40 hover:text-parchment">✕</button>
        </div>
      )}

      {npcs.length === 0 && (
        <p className="text-parchment/30 text-xs text-center py-2">Создайте НПС, чтобы добавить в очередь</p>
      )}

      {npcs.length > 0 && (
        <>
          <div className="relative">
            <input
              value={npcSearch}
              onChange={(e) => setNpcSearch(e.target.value)}
              placeholder="Поиск по НПС..."
              className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30"
            />
            {npcSearch && (
              <button
                onClick={() => setNpcSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-parchment/30 hover:text-parchment/70 text-xs"
              >✕</button>
            )}
          </div>

          {npcSearch.trim() ? (
            <div className="flex flex-col gap-1">
              {npcs.filter((n) => n.name.toLowerCase().includes(npcSearch.toLowerCase())).length === 0 ? (
                <p className="text-parchment/30 text-xs text-center py-2">Не найдено</p>
              ) : (
                npcs
                  .filter((n) => n.name.toLowerCase().includes(npcSearch.toLowerCase()))
                  .map((n) => (
                    <NpcCard
                      key={n.id}
                      npc={n}
                      onEdit={() => openEdit(n)}
                      onDelete={() => handleDelete(n)}
                      onAddToPool={() => addToPool(n)}
                    />
                  ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {renderFolderSection('all', 'Все НПС', npcs)}
              {recentNpcs.length > 0 && renderFolderSection('recent', 'Недавние', recentNpcs)}
              {folders.map((f) => {
                const items = npcs.filter((n) => n.folder_id === f.id)
                return renderFolderSection(
                  f.id, f.name, items,
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id) }}
                    className="text-parchment/25 hover:text-ember text-xs w-5 h-5 flex items-center justify-center shrink-0 transition-colors"
                    title="Удалить папку"
                  >✕</button>
                )
              })}
              {noFolderNpcs.length > 0 && renderFolderSection('none', 'Без папки', noFolderNpcs)}
            </div>
          )}
        </>
      )}

      <hr className="border-dark-border" />

      <span className="text-parchment/50 text-xs font-fantasy">Бестиарий</span>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск монстра..."
          className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-xs text-parchment placeholder-parchment/30"
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-parchment/30 text-xs animate-pulse">…</span>
        )}
        {query && (results.length > 0 || (!loading && query)) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-dark-card border border-dark-border rounded shadow-xl max-h-72 overflow-y-auto flex flex-col">
            {results.length === 0 ? (
              <p className="text-parchment/30 text-xs text-center py-4">Не найдено</p>
            ) : (
              results.map((m) => {
                const maxHpStr = m.hit_points || '1'
                const maxHpNum = parseInt(m.hit_points) || 1
                return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy'
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        token_type: 'npc',
                        bestiary_id: m.id,
                        name: m.name_ru,
                        disposition: 'hostile',
                        max_hp: maxHpStr,
                        current_hp: maxHpNum,
                      }))
                    }}
                    className="flex items-center gap-2 px-2 py-2 hover:bg-dark border-b border-dark-border/30 last:border-0 group cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-parchment truncate">{m.name_ru}</p>
                      <p className="text-parchment/30 text-xs truncate">КД {m.armor_class} · {m.hit_points} хп</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToNpcs(m) }}
                        className="text-xs px-1.5 py-0.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light transition-colors"
                        title="Скопировать в Свои НПС"
                      >📋</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToPool({
                            token_type: 'npc',
                            bestiary_id: m.id,
                            name: m.name_ru,
                            disposition: 'hostile',
                            max_hp: maxHpStr,
                            current_hp: maxHpNum,
                            subtitle: `КД ${m.armor_class} · ${m.hit_points} хп`,
                          })
                        }}
                        className="text-xs px-1.5 py-0.5 bg-ember/20 hover:bg-ember/30 border border-ember/30 rounded text-ember transition-colors"
                      >+ очередь</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <NpcModal
          roomCode={roomCode}
          npc={editNpc ?? undefined}
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

interface SetupEntry {
  token_id: string
  character_id?: string
  npc_id?: string
  name: string
  disposition: 'friendly' | 'neutral' | 'hostile'
  initiative: number | null
  advantage: number
  dex_mod: number
}

function InitiativeTab({ sendMessage }: { sendMessage: Props['sendMessage'] }) {
  const gameState = useGameStore((s) => s.gameState)
  const tokens = useGameStore((s) => s.tokens)
  const characters = useGameStore((s) => s.characters)
  const npcs = useGameStore((s) => s.npcs)
  const activeInitIndex = useGameStore((s) => s.activeInitIndex)

  const [entries, setEntries] = useState<SetupEntry[]>([])
  const [addingTokenId, setAddingTokenId] = useState<string | null>(null)
  const [addAdvantage, setAddAdvantage] = useState(0)
  const [addInitiative, setAddInitiative] = useState<number>(0)

  const order = gameState?.initiative_order ?? []
  const inCombat = order.length > 0

  const getDexMod = (t: { character_id?: string; npc_id?: string }) => {
    const char = t.character_id ? characters.find((c) => c.id === t.character_id) : undefined
    const npc = t.npc_id ? npcs.find((n) => n.id === t.npc_id) : undefined
    if (char?.stats?.dex_mod !== undefined) return char.stats.dex_mod
    if (npc?.abilities?.dex) return Math.floor((npc.abilities.dex - 10) / 2)
    return 0
  }

  const makeSetupEntry = (t: { id: string; character_id?: string; npc_id?: string; name: string; disposition: 'friendly' | 'neutral' | 'hostile' }): SetupEntry => ({
    token_id: t.id,
    character_id: t.character_id,
    npc_id: t.npc_id,
    name: t.name,
    disposition: t.disposition,
    initiative: null,
    advantage: 0,
    dex_mod: getDexMod(t),
  })

  const loadFromMap = () => setEntries(tokens.map(makeSetupEntry))

  const autoRoll = () =>
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        initiative:
          e.initiative !== null
            ? e.initiative
            : Math.floor(Math.random() * 20) + 1 + e.dex_mod + e.advantage,
      }))
    )

  const startCombat = () => {
    const filled = entries.map((e) => ({
      token_id: e.token_id,
      character_id: e.character_id,
      npc_id: e.npc_id,
      name: e.name,
      initiative:
        e.initiative ??
        Math.floor(Math.random() * 20) + 1 + e.dex_mod + e.advantage,
      advantage: e.advantage,
      dex_mod: e.dex_mod,
    }))
    sendMessage('INIT_UPDATE', [...filled].sort((a, b) => b.initiative - a.initiative))
  }

  useEffect(() => {
    const currentOrder = useGameStore.getState().gameState?.initiative_order ?? []
    if (currentOrder.length === 0) return
    const tokenIds = new Set(tokens.map((t) => t.id))
    const newOrder = currentOrder.filter((e) => {
      if (!tokenIds.has(e.token_id)) return false
      const token = tokens.find((t) => t.id === e.token_id)
      if (!e.character_id && token && typeof token.current_hp === 'number' && token.current_hp <= 0) return false
      return true
    })
    if (newOrder.length !== currentOrder.length) sendMessage('INIT_UPDATE', newOrder)
  }, [tokens, sendMessage])

  const updateEntry = (i: number, field: keyof SetupEntry, value: unknown) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))

  if (!inCombat) {
    return (
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-fantasy text-parchment/50">Настройка боя</span>
          <button
            onClick={loadFromMap}
            className="text-xs px-2 py-1 bg-dark hover:bg-dark-hover border border-dark-border rounded text-parchment/60 hover:text-parchment transition-colors"
          >
            Из карты
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {entries.length === 0 && (
            <p className="text-parchment/30 text-xs text-center py-4">
              Нажмите «Из карты» чтобы загрузить участников
            </p>
          )}
          {entries.map((e, i) => (
            <div
              key={e.token_id}
              className="bg-dark border border-dark-border/50 rounded p-2 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-xs shrink-0 ${e.character_id ? 'text-token-pc' : DISP_DOT[e.disposition]}`}>●</span>
                <span className="flex-1 text-xs text-parchment truncate">{e.name}</span>
                <button
                  onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                  className="text-parchment/40 hover:text-ember text-xs w-5 h-5 flex items-center justify-center shrink-0 transition-colors"
                  title="Убрать из инициативы"
                >✕</button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-parchment/40 shrink-0 w-12">
                  ЛОВ {e.dex_mod >= 0 ? '+' : ''}{e.dex_mod}
                </span>
                <label className="flex items-center gap-1 shrink-0">
                  <span className="text-parchment/40">Преим</span>
                  <input
                    type="number"
                    value={e.advantage !== 0 ? e.advantage : ''}
                    onChange={(ev) => updateEntry(i, 'advantage', parseInt(ev.target.value) || 0)}
                    placeholder="0"
                    className="w-10 bg-dark-card border border-dark-border rounded px-1 py-0.5 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </label>
                <label className="flex items-center gap-1 ml-auto shrink-0">
                  <span className="text-parchment/40">Иниц</span>
                  <input
                    type="number"
                    value={e.initiative !== null ? e.initiative : ''}
                    onChange={(ev) =>
                      updateEntry(i, 'initiative', ev.target.value === '' ? null : parseInt(ev.target.value) || 0)
                    }
                    placeholder="—"
                    className="w-10 bg-dark-card border border-dark-border rounded px-1 py-0.5 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        {entries.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={autoRoll}
              className="flex-1 py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment font-fantasy transition-colors"
            >
              Авто-бросок
            </button>
            <button
              onClick={startCombat}
              className="flex-1 py-1.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
            >
              Начать бой
            </button>
          </div>
        )}
      </div>
    )
  }

  const inCombatIds = new Set(order.map((e) => e.token_id))
  const notInCombat = tokens.filter((t) => !inCombatIds.has(t.id))

  const openAddForm = (t: (typeof tokens)[0]) => {
    const dexMod = getDexMod(t)
    const roll = Math.floor(Math.random() * 20) + 1 + dexMod
    setAddingTokenId(t.id)
    setAddAdvantage(0)
    setAddInitiative(roll)
  }

  const confirmAddToCombat = (t: (typeof tokens)[0]) => {
    const dexMod = getDexMod(t)
    const newEntry: InitiativeEntry = {
      token_id: t.id,
      character_id: t.character_id,
      npc_id: t.npc_id,
      name: t.name,
      initiative: addInitiative,
      advantage: addAdvantage,
      dex_mod: dexMod,
    }
    sendMessage('INIT_UPDATE', [...order, newEntry].sort((a, b) => b.initiative - a.initiative))
    setAddingTokenId(null)
    setAddAdvantage(0)
    setAddInitiative(0)
  }

  const removeFromCombat = (tokenId: string) =>
    sendMessage('INIT_UPDATE', order.filter((e) => e.token_id !== tokenId))

  return (
    <div className="p-3 flex flex-col gap-3">
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
        {order.map((e, i) => {
          const isActive = i === activeInitIndex % order.length
          const token = tokens.find((t) => t.id === e.token_id)
          const dotColor = e.character_id ? 'text-token-pc' : DISP_DOT[token?.disposition ?? 'hostile']
          return (
            <div
              key={e.token_id}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded border ${
                isActive ? 'bg-gold/10 border-gold/40' : 'bg-dark border-dark-border/50'
              }`}
            >
              {isActive
                ? <span className="text-gold-light text-xs shrink-0">▶</span>
                : <span className={`text-xs shrink-0 ${dotColor}`}>●</span>
              }
              <span className={`flex-1 text-xs truncate ${isActive ? 'text-gold-light font-semibold' : 'text-parchment'}`}>
                {e.name}
              </span>
              <span className="text-parchment/50 text-xs font-mono shrink-0 w-6 text-right">{e.initiative}</span>
              <button
                onClick={() => removeFromCombat(e.token_id)}
                className="text-ember/40 hover:text-ember text-xs w-5 h-5 flex items-center justify-center shrink-0"
              >✕</button>
            </div>
          )
        })}
      </div>

      {notInCombat.length > 0 && (
        <>
          <p className="text-parchment/30 text-xs font-fantasy border-t border-dark-border pt-2">Не в бою</p>
          <div className="flex flex-col gap-1">
            {notInCombat.map((t) => {
              const dexMod = getDexMod(t)
              const isAdding = addingTokenId === t.id
              return (
                <div key={t.id} className="flex flex-col rounded bg-dark border border-dark-border/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className={`text-xs shrink-0 ${t.character_id ? 'text-token-pc' : DISP_DOT[t.disposition]}`}>●</span>
                    <span className="text-xs text-parchment/60 truncate flex-1">{t.name}</span>
                    {!isAdding && (
                      <button
                        onClick={() => openAddForm(t)}
                        className="text-xs px-1.5 py-0.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light transition-colors shrink-0"
                      >
                        + в бой
                      </button>
                    )}
                    {isAdding && (
                      <button
                        onClick={() => setAddingTokenId(null)}
                        className="text-parchment/40 hover:text-parchment text-xs transition-colors shrink-0"
                      >
                        Отмена
                      </button>
                    )}
                  </div>
                  {isAdding && (
                    <div className="px-2 pb-2 flex flex-col gap-1.5 border-t border-dark-border/30 pt-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-parchment/40 shrink-0 w-12">
                          ЛОВ {dexMod >= 0 ? '+' : ''}{dexMod}
                        </span>
                        <label className="flex items-center gap-1 shrink-0">
                          <span className="text-parchment/40">Преим</span>
                          <input
                            type="number"
                            value={addAdvantage !== 0 ? addAdvantage : ''}
                            onChange={(ev) => {
                              const v = parseInt(ev.target.value) || 0
                              setAddAdvantage(v)
                              setAddInitiative((prev) => prev - addAdvantage + v)
                            }}
                            placeholder="0"
                            className="w-10 bg-dark-card border border-dark-border rounded px-1 py-0.5 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 ml-auto shrink-0">
                          <span className="text-parchment/40">Иниц</span>
                          <input
                            type="number"
                            value={addInitiative}
                            onChange={(ev) => setAddInitiative(parseInt(ev.target.value) || 0)}
                            className="w-10 bg-dark-card border border-dark-border rounded px-1 py-0.5 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </label>
                      </div>
                      <button
                        onClick={() => confirmAddToCombat(t)}
                        className="w-full py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light font-fantasy transition-colors"
                      >
                        Добавить в бой
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}


function CharsTab({
  roomCode,
  onAddToPool,
  sendMessage,
}: {
  roomCode: string
  onAddToPool: (entry: Omit<PoolEntry, '_key'>) => void
  sendMessage: (type: string, payload?: unknown) => void
}) {
  const characters = useGameStore((s) => s.characters)
  const [modalOpen, setModalOpen] = useState(false)
  const [editChar, setEditChar] = useState<Character | null>(null)

  const openCreate = () => { setEditChar(null); setModalOpen(true) }
  const openEdit = (c: Character) => { setEditChar(c); setModalOpen(true) }

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-parchment/50 text-xs font-fantasy">
          Персонажи ({characters.length})
        </span>
        <button
          onClick={openCreate}
          className="text-xs px-2 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light font-fantasy transition-colors"
        >
          + Создать
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {characters.length === 0 && (
          <p className="text-parchment/30 text-xs text-center py-4">Персонажей нет</p>
        )}
        {characters.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData('application/json', JSON.stringify({
                token_type: 'pc',
                character_id: c.id,
                name: c.name,
                disposition: 'friendly',
              }))
            }}
            className="flex items-center gap-2 px-2 py-2 rounded bg-dark border border-dark-border/50 hover:border-dark-border group cursor-grab active:cursor-grabbing"
          >
            <span className="text-xs shrink-0 text-token-pc">●</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-parchment truncate">{c.name}</p>
              <p className="text-parchment/30 text-xs truncate">
                {[c.class, c.race, c.level ? `${c.level} ур.` : ''].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToPool({
                    token_type: 'pc',
                    character_id: c.id,
                    name: c.name,
                    disposition: 'friendly',
                    subtitle: [c.class, c.race, c.level ? `${c.level} ур.` : ''].filter(Boolean).join(' · '),
                  })
                }}
                className="text-xs px-1.5 py-0.5 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-gold-light transition-colors"
              >
                + очередь
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                className="text-parchment/40 hover:text-gold-light text-sm w-5 h-5 flex items-center justify-center transition-colors"
                title="Редактировать"
              >
                ✎
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <CharacterModal
          roomCode={roomCode}
          character={editChar ?? undefined}
          sendMessage={sendMessage}
          role="dm"
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

function MapTab({ sendMessage, roomCode }: { sendMessage: Props['sendMessage']; roomCode: string }) {
  const gameState = useGameStore((s) => s.gameState)
  const [gridEnabled, setGridEnabled] = useState(gameState?.grid_enabled ?? true)
  const [gridSize, setGridSize] = useState(gameState?.grid_size ?? 50)
  const [gridSizeInput, setGridSizeInput] = useState(String(gameState?.grid_size ?? 50))
  const [gridSizeError, setGridSizeError] = useState('')
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
    const parsed = parseInt(gridSizeInput)
    if (!gridSizeInput || isNaN(parsed) || parsed < 1) {
      setGridSizeError('Размер: больше 0')
      return
    }
    setGridSizeError('')
    setGridSize(parsed)
    sendMessage('GRID_UPDATE', { grid_enabled: gridEnabled, grid_size: parsed })
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
          <div className="relative">
            <input
              type="number"
              value={gridSizeInput}
              min={1}
              onChange={(e) => { setGridSizeInput(e.target.value); setGridSizeError('') }}
              className={`w-16 bg-dark border rounded px-2 py-1 text-xs text-parchment text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors ${
                gridSizeError ? 'border-ember/70' : 'border-dark-border'
              }`}
            />
            {gridSizeError && (
              <div className="absolute bottom-full left-0 mb-1.5 w-40 bg-dark-card border border-ember/40 rounded px-2 py-1.5 text-xs shadow-xl z-50 pointer-events-none">
                <p className="text-ember font-fantasy">{gridSizeError}</p>
              </div>
            )}
          </div>
          <span className="text-xs text-parchment/30">px</span>
        </div>
        <button
          onClick={applyGrid}
          className="w-full py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment font-fantasy transition-colors"
        >
          Применить сетку
        </button>
      </div>

      <hr className="border-dark-border" />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-fantasy text-parchment/50">Туман войны</p>
        <button
          onClick={() => sendMessage('FOG_FILL')}
          className="w-full py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment font-fantasy transition-colors"
        >
          Покрыть туманом
        </button>
        <button
          onClick={() => sendMessage('FOG_CLEAR')}
          className="w-full py-1.5 bg-ember/10 hover:bg-ember/20 border border-ember/30 rounded text-xs text-ember/70 hover:text-ember font-fantasy transition-colors"
        >
          Убрать весь туман
        </button>
      </div>

      <hr className="border-dark-border" />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-fantasy text-parchment/50">Сброс</p>
        <button
          onClick={() => { if (window.confirm('Убрать карту? Токены останутся.')) sendMessage('MAP_CLEAR') }}
          className="w-full py-1.5 bg-dark hover:bg-dark-hover border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment font-fantasy transition-colors"
        >
          Убрать карту
        </button>
        <button
          onClick={() => { if (window.confirm('Очистить сессию? Будут удалены все токены, карта и инициатива.')) sendMessage('SESSION_CLEAR') }}
          className="w-full py-1.5 bg-ember/10 hover:bg-ember/20 border border-ember/30 rounded text-xs text-ember/70 hover:text-ember font-fantasy transition-colors"
        >
          Очистить сессию
        </button>
      </div>
    </div>
  )
}
