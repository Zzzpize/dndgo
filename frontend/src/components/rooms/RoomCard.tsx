'use client'

import { useState } from 'react'
import api from '@/lib/api'

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
  onRenamed: (id: string, name: string) => void
  onDeleted: (id: string) => void
  onLeft: (id: string) => void
}

interface RoomSettings {
  player_can_move_token: boolean
  player_can_reveal_fog: boolean
  player_can_edit_token: boolean
  player_can_edit_hp: boolean
  player_can_edit_sheet: boolean
  players_see_dm_rolls: boolean
  player_can_roll_dice: boolean
}

type Panel = 'rename' | 'delete' | 'leave' | 'settings' | null

export function RoomCard({ room, onEnter, onRenamed, onDeleted, onLeft }: RoomCardProps) {
  const [showCode, setShowCode] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [renameInput, setRenameInput] = useState('')
  const [deleteInput, setDeleteInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<RoomSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)

  const closePanel = () => {
    setPanel(null)
    setRenameInput('')
    setDeleteInput('')
    setError('')
  }

  const openPanel = (p: Panel) => {
    closePanel()
    setPanel(p)
    if (p === 'rename') setRenameInput(room.name)
    if (p === 'settings' && !settings) {
      setSettingsLoading(true)
      api.get<RoomSettings>(`/api/v1/rooms/${room.code}/settings`)
        .then(({ data }) => setSettings(data))
        .finally(() => setSettingsLoading(false))
    }
  }

  const toggleSetting = async (key: keyof RoomSettings, value: boolean) => {
    if (!settings) return
    const next = { ...settings, [key]: value }
    setSettings(next)
    await api.patch(`/api/v1/rooms/${room.code}/settings`, next)
  }

  const handleRename = async () => {
    if (!renameInput.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.patch(`/api/v1/rooms/${room.code}`, { name: renameInput.trim() })
      onRenamed(room.id, renameInput.trim())
      closePanel()
    } catch {
      setError('Ошибка при переименовании')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (deleteInput !== room.name) return
    setBusy(true)
    setError('')
    try {
      await api.delete(`/api/v1/rooms/${room.code}`)
      onDeleted(room.id)
    } catch {
      setError('Ошибка при удалении')
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    setBusy(true)
    setError('')
    try {
      await api.delete(`/api/v1/rooms/${room.code}/leave`)
      onLeft(room.id)
    } catch {
      setError('Ошибка при выходе')
      setBusy(false)
    }
  }

  const isDm = room.role === 'dm'

  return (
    <div className="bg-dark-card border border-dark-border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="heading-fantasy text-lg">{room.name}</h3>
          <span className={`text-xs uppercase tracking-widest font-fantasy ${isDm ? 'text-gold' : 'text-steel-light'}`}>
            {isDm ? '⚔ Мастер' : '⚉ Игрок'}
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

      {panel === null && (
        <div className="flex gap-2 pt-1 border-t border-dark-border">
          {isDm ? (
            <>
              <button
                onClick={() => openPanel('settings')}
                className="flex-1 py-1 text-xs text-parchment/50 hover:text-parchment/80 border border-dark-border hover:border-parchment/30 rounded font-fantasy transition-colors"
              >
                Настройки
              </button>
              <button
                onClick={() => openPanel('rename')}
                className="flex-1 py-1 text-xs text-parchment/50 hover:text-parchment/80 border border-dark-border hover:border-parchment/30 rounded font-fantasy transition-colors"
              >
                Переименовать
              </button>
              <button
                onClick={() => openPanel('delete')}
                className="flex-1 py-1 text-xs text-ember/60 hover:text-ember border border-ember/20 hover:border-ember/40 rounded font-fantasy transition-colors"
              >
                Удалить
              </button>
            </>
          ) : (
            <button
              onClick={() => openPanel('leave')}
              className="flex-1 py-1 text-xs text-parchment/50 hover:text-parchment/80 border border-dark-border hover:border-parchment/30 rounded font-fantasy transition-colors"
            >
              Выйти из комнаты
            </button>
          )}
        </div>
      )}

      {panel === 'rename' && (
        <div className="flex flex-col gap-2 pt-1 border-t border-dark-border">
          <p className="text-xs text-parchment/50 font-fantasy">Новое название</p>
          <input
            autoFocus
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="w-full bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30"
          />
          {error && <p className="text-ember text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleRename}
              disabled={busy || !renameInput.trim()}
              className="flex-1 py-1 text-xs bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold-light rounded font-fantasy transition-colors disabled:opacity-40"
            >
              Сохранить
            </button>
            <button
              onClick={closePanel}
              className="flex-1 py-1 text-xs text-parchment/50 hover:text-parchment border border-dark-border rounded font-fantasy transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {panel === 'delete' && (
        <div className="flex flex-col gap-2 pt-1 border-t border-dark-border">
          <p className="text-xs text-parchment/50">Введите название комнаты для подтверждения:</p>
          <p className="text-xs font-mono text-parchment/40 italic">«{room.name}»</p>
          <input
            autoFocus
            type="text"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
            className="w-full bg-dark border border-dark-border rounded px-2 py-1 text-xs text-parchment placeholder-parchment/30"
            placeholder="Название комнаты"
          />
          {error && <p className="text-ember text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={busy || deleteInput !== room.name}
              className="flex-1 py-1 text-xs bg-ember/20 hover:bg-ember/30 border border-ember/40 text-ember rounded font-fantasy transition-colors disabled:opacity-40"
            >
              Удалить
            </button>
            <button
              onClick={closePanel}
              className="flex-1 py-1 text-xs text-parchment/50 hover:text-parchment border border-dark-border rounded font-fantasy transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {panel === 'leave' && (
        <div className="flex flex-col gap-2 pt-1 border-t border-dark-border">
          <p className="text-xs text-parchment/60">Вы уверены, что хотите выйти из комнаты?</p>
          {error && <p className="text-ember text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleLeave}
              disabled={busy}
              className="flex-1 py-1 text-xs bg-ember/20 hover:bg-ember/30 border border-ember/40 text-ember rounded font-fantasy transition-colors disabled:opacity-40"
            >
              Подтвердить
            </button>
            <button
              onClick={closePanel}
              className="flex-1 py-1 text-xs text-parchment/50 hover:text-parchment border border-dark-border rounded font-fantasy transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {panel === 'settings' && (
        <div className="flex flex-col gap-3 pt-1 border-t border-dark-border">
          <p className="text-xs font-fantasy text-parchment/50">Права игроков</p>
          {settingsLoading || !settings ? (
            <p className="text-xs text-parchment/30 animate-pulse">Загрузка...</p>
          ) : (
            <div className="flex flex-col gap-2">
              {([
                { key: 'player_can_move_token' as const, label: 'Перемещать токен', indent: false },
                { key: 'player_can_reveal_fog' as const, label: 'Раскрывать туман', indent: true, parentKey: 'player_can_move_token' as const },
                { key: 'player_can_edit_token' as const, label: 'Редактировать персонажа', indent: false },
                { key: 'player_can_edit_hp' as const, label: 'Менять HP', indent: true, parentKey: 'player_can_edit_token' as const },
                { key: 'player_can_edit_sheet' as const, label: 'Редактировать анкету', indent: true, parentKey: 'player_can_edit_token' as const },
                { key: 'players_see_dm_rolls' as const, label: 'Видят броски мастера', indent: false },
                { key: 'player_can_roll_dice' as const, label: 'Бросать кубики', indent: false },
              ] as Array<{ key: keyof RoomSettings; label: string; indent: boolean; parentKey?: keyof RoomSettings }>).map(({ key, label, indent, parentKey }) => {
                const disabled = parentKey ? !settings[parentKey] : false
                const value = settings[key]
                return (
                  <div key={key} className={`flex items-center gap-2 ${indent ? 'pl-3' : ''}`}>
                    {indent && <span className="text-parchment/20 text-xs">└</span>}
                    <span className={`flex-1 text-xs ${disabled ? 'text-parchment/30' : 'text-parchment/70'}`}>{label}</span>
                    <button
                      onClick={() => !disabled && toggleSetting(key, !value)}
                      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${value && !disabled ? 'bg-gold/70' : value ? 'bg-gold/40' : 'bg-dark-border'}`}
                    >
                      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-parchment transition-all" style={{ left: value ? '18px' : '2px' }} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <button
            onClick={closePanel}
            className="py-1 text-xs text-parchment/50 hover:text-parchment border border-dark-border rounded font-fantasy transition-colors"
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  )
}
