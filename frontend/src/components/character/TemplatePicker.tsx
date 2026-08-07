'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { Character, useGameStore } from '@/store/gameStore'
import { useAuthStore } from '@/store/authStore'
import { CharacterTemplate } from './TemplateModal'
import { CharacterModal } from './CharacterModal'

interface Props {
  roomCode: string
  sendMessage?: (type: string, payload?: unknown) => void
  onClose: () => void
  onImported: (char: Character) => void
}

export function TemplatePicker({ roomCode, sendMessage, onClose, onImported }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const addCharacter = useGameStore((s) => s.addCharacter)
  const updateCharacter = useGameStore((s) => s.updateCharacter)
  const allCharacters = useGameStore((s) => s.characters)
  const myUserId = useAuthStore((s) => s.user?.id)
  const [templates, setTemplates] = useState<CharacterTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [showCreateNew, setShowCreateNew] = useState(false)

  const ownedInRoom = allCharacters.filter((c) => c.user_id === myUserId)
  const inactiveOwned = ownedInRoom.filter((c) => !(c.player_active ?? true))
  const ownedNames = new Set(ownedInRoom.map((c) => c.name))

  useEffect(() => {
    api.get('/api/v1/characters/templates')
      .then(({ data }) => setTemplates(data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const handleReclaim = async (charId: string) => {
    if (importingId) return
    setImportingId(charId)
    try {
      const { data } = await api.patch<Character>(`/api/v1/characters/${charId}/active`, { active: true })
      updateCharacter(data)
      sendMessage?.('CHARACTER_UPDATE', data)
      onImported(data)
    } catch {
      // ignore
    } finally {
      setImportingId(null)
    }
  }

  const handleImport = async (templateId: string) => {
    if (importingId) return
    setImportingId(templateId)
    try {
      const { data } = await api.post<Character>(
        `/api/v1/rooms/${roomCode}/characters/from-template/${templateId}`
      )
      addCharacter(data)
      sendMessage?.('CHARACTER_UPDATE', data)
      onImported(data)
    } catch {
      // ignore
    } finally {
      setImportingId(null)
    }
  }

  if (showCreateNew) {
    return (
      <CharacterModal
        roomCode={roomCode}
        sendMessage={sendMessage}
        role="player"
        onClose={onClose}
        onSaved={(char) => { onImported(char); onClose() }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-dark-border rounded-lg w-full max-w-sm flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
          <h2 className="font-fantasy text-gold-light text-base">Добавить персонажа</h2>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment/70 w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {inactiveOwned.length > 0 && (
            <div className="border-b border-dark-border">
              <p className="px-4 pt-3 pb-1 text-xs text-parchment/40 font-fantasy">Вернуться к персонажу</p>
              <div className="flex flex-col divide-y divide-dark-border">
                {inactiveOwned.map((c) => {
                  const subtitle = [c.race, c.class].filter(Boolean).join(' · ')
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-dark/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-parchment truncate">{c.name}</p>
                        {subtitle && <p className="text-xs text-parchment/40 truncate">{subtitle}</p>}
                      </div>
                      <span className="text-xs text-parchment/30 shrink-0">Ур. {c.level}</span>
                      <button
                        onClick={() => handleReclaim(c.id)}
                        disabled={importingId === c.id}
                        className="shrink-0 px-3 py-1 bg-sky-900/30 hover:bg-sky-900/50 border border-sky-900/40 rounded text-xs text-sky-300 transition-colors disabled:opacity-50"
                      >
                        {importingId === c.id ? '...' : 'Вернуть'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-parchment/40 text-sm animate-pulse">Загрузка...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
              <p className="text-parchment/40 text-sm">Нет сохранённых шаблонов</p>
              <Link
                href="/characters"
                target="_blank"
                className="text-xs text-gold-light/70 hover:text-gold-light underline transition-colors"
              >
                Создать персонажа в библиотеке →
              </Link>
            </div>
          ) : (
            <>
              {(() => {
                const filtered = templates.filter((t) => !ownedNames.has(t.name))
                if (filtered.length === 0) return null
                return (
                  <>
                    {inactiveOwned.length > 0 && (
                      <p className="px-4 pt-3 pb-1 text-xs text-parchment/40 font-fantasy">Взять нового из шаблона</p>
                    )}
                    <div className="flex flex-col divide-y divide-dark-border">
                      {filtered.map((t) => {
                  const subtitle = [t.race, t.class].filter(Boolean).join(' · ')
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-dark/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-parchment truncate">{t.name}</p>
                        {subtitle && <p className="text-xs text-parchment/40 truncate">{subtitle}</p>}
                      </div>
                      <span className="text-xs text-parchment/30 shrink-0">Ур. {t.level}</span>
                      <button
                        onClick={() => handleImport(t.id)}
                        disabled={importingId === t.id}
                        className="shrink-0 px-3 py-1 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded text-xs text-gold-light transition-colors disabled:opacity-50"
                      >
                        {importingId === t.id ? '...' : 'Взять'}
                      </button>
                    </div>
                  )
                      })}
                    </div>
                  </>
                )
              })()}
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-dark-border shrink-0">
          <button
            onClick={() => setShowCreateNew(true)}
            className="w-full py-2 border border-dark-border rounded text-xs text-parchment/60 hover:text-parchment hover:border-parchment/30 transition-colors"
          >
            Создать нового персонажа
          </button>
        </div>
      </div>
    </div>
  )
}
