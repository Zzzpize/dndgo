'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { Room } from './RoomCard'

interface CreateRoomModalProps {
  open: boolean
  onClose: () => void
  onCreated: (room: Room) => void
}

export function CreateRoomModal({ open, onClose, onCreated }: CreateRoomModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Введите название'); return }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/rooms', { name: name.trim() })
      setName('')
      onCreated(data)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Ошибка создания комнаты')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Создать комнату">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Подземелья и Драконы..."
          error={error}
          autoFocus
        />
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading}>Создать</Button>
        </div>
      </form>
    </Modal>
  )
}
