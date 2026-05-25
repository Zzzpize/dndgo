'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { Character, useGameStore } from '@/store/gameStore'
import { CharacterTemplate } from './TemplateModal'
import { CharacterModal } from './CharacterModal'

interface Props {
  roomCode: string
  sendMessage?: (type: string, payload?: unknown) => void
  onClose: () => void
  onImported: (char: Character) => void
}

export function TemplatePicker({ roomCode, sendMessage, onClose, onImported }: Props) {
  const addCharacter = useGameStore((s) => s.addCharacter)
  const [templates, setTemplates] = useState<CharacterTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [showCreateNew, setShowCreateNew] = useState(false)

  useEffect(() => {
    api.get('/api/v1/characters/templates')
      .then(({ data }) => setTemplates(data ?? []))
      .finally(() => setLoading(false))
  }, [])

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-dark-card border border-dark-border rounded-lg w-full max-w-sm flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
          <h2 className="font-fantasy text-gold-light text-base">Добавить персонажа</h2>
          <button onClick={onClose} className="text-parchment/40 hover:text-parchment/70 w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
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
            <div className="flex flex-col divide-y divide-dark-border">
              {templates.map((t) => {
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
