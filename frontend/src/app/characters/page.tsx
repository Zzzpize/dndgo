'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { TemplateModal, CharacterTemplate } from '@/components/character/TemplateModal'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'

export default function CharactersPage() {
  const router = useRouter()
  const { user, hydrated, hydrate, logout } = useAuthStore()
  const [templates, setTemplates] = useState<CharacterTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CharacterTemplate | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    if (!hydrated) return
    if (!user) { router.replace('/login'); return }
    api.get('/api/v1/characters/templates')
      .then(({ data }) => setTemplates(data ?? []))
      .finally(() => setLoading(false))
  }, [hydrated, user, router])

  const openCreate = () => { setEditing(undefined); setModalOpen(true) }
  const openEdit = (t: CharacterTemplate) => { setEditing(t); setModalOpen(true) }

  const handleSaved = (t: CharacterTemplate) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = t
        return updated
      }
      return [t, ...prev]
    })
    setModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await api.delete(`/api/v1/characters/templates/${id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-parchment/40 font-fantasy tracking-widest animate-pulse">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-dark-border bg-dark-card px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/rooms" className="heading-fantasy text-xl hover:text-gold-light transition-colors">D&D VTT</Link>
          <nav className="flex items-center gap-3 sm:gap-4">
            <Link href="/rooms" className="text-sm text-parchment/60 hover:text-parchment transition-colors">Комнаты</Link>
            <span className="text-sm text-gold-light font-fantasy">Персонажи</span>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden sm:inline text-sm text-parchment/60">{user?.username}</span>
          <Button variant="ghost" onClick={logout} className="text-xs">Выйти</Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="heading-fantasy text-2xl">Мои персонажи</h2>
            <p className="text-parchment/50 text-sm mt-1">Шаблоны для любых приключений</p>
          </div>
          <Button onClick={openCreate}>+ Новый шаблон</Button>
        </div>

        <hr className="divider-gold mb-6" />

        {templates.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">⚔️</p>
            <p className="heading-fantasy text-xl text-parchment/40 mb-2">Нет персонажей</p>
            <p className="text-parchment/30 text-sm">Создайте шаблон, чтобы брать его в любую комнату</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                deleting={deletingId === t.id}
                onEdit={() => openEdit(t)}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <TemplateModal
          template={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function TemplateCard({
  template,
  deleting,
  onEdit,
  onDelete,
}: {
  template: CharacterTemplate
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const subtitle = [template.race, template.class].filter(Boolean).join(' · ')
  const hpDisplay = `${template.hp}/${template.max_hp} HP`

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-fantasy text-parchment text-base truncate">{template.name}</p>
          {subtitle && <p className="text-xs text-parchment/50 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <span className="text-xs text-parchment/40 border border-dark-border rounded px-1.5 py-0.5 shrink-0">
          Ур. {template.level}
        </span>
      </div>

      <div className="flex gap-3 text-xs text-parchment/50">
        <span>{hpDisplay}</span>
        <span>КД {template.effective_ac}</span>
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={onEdit}
          className="flex-1 py-1.5 text-xs border border-dark-border rounded text-parchment/60 hover:text-parchment hover:border-parchment/30 transition-colors"
        >
          Редактировать
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="px-3 py-1.5 text-xs border border-ember/30 rounded text-ember/60 hover:text-ember hover:border-ember/60 transition-colors disabled:opacity-40"
        >
          {deleting ? '...' : 'Удалить'}
        </button>
      </div>
    </div>
  )
}
